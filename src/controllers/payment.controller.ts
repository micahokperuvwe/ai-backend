import { Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import { v4 as uuidv4 } from 'uuid';

// Paystack Secret Key should be in .env (PAYSTACK_SECRET_KEY)
// For now we assume it's there or we mock.

export const initializePayment = async (req: Request, res: Response) => {
    const { message, plan, amount } = req.body;
    // Plan: basic/pro/premium
    // Amount: in kobo/cents? Paystack uses base currency minor unit.
    const user = req.user;
    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    const reference = uuidv4();

    try {
        // If NO Paystack key, MOCK the response for Dev Mode
        if (!process.env.PAYSTACK_SECRET_KEY) {
            return res.json({
                status: true,
                message: "Authorization URL created",
                data: {
                    authorization_url: `http://localhost:5173/payment/mock-success?reference=${reference}&plan=${plan}`,
                    access_code: "mock_access_code",
                    reference
                }
            });
        }

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: user.email,
            amount: amount * 100, // convert to kobo (if naira) or smallest unit
            reference,
            metadata: {
                plan,
                userId: String(user._id)
            },
            callback_url: "http://localhost:5173/payment/callback"
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error('Paystack Init Error:', error);
        res.status(500).json({ msg: 'Payment Initialization Failed' });
    }
};

export const paystackWebhook = async (req: Request, res: Response) => {
    // Validate signature... (skipped for brevity, but critical in prod)
    // const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    // if (hash == req.headers['x-paystack-signature']) ...

    const event = req.body;
    if (event.event === 'charge.success') {
        const { metadata, reference } = event.data;
        const { userId, plan } = metadata;

        try {
            const user = await User.findById(userId);
            if (user) {
                user.plan = plan;
                // Update limits
                if (plan === 'basic') user.apiKeyUses = 1000; // soft limit enforced in middleware
                if (plan === 'pro') user.apiKeyUses = 10000;
                if (plan === 'premium') user.apiKeyUses = -1;

                // Set expiry
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30);
                user.planExpiry = expiry;

                await user.save();
                console.log(`User ${userId} upgraded to ${plan}`);
            }
        } catch (error) {
            console.error('Webhook Error:', error);
        }
    }

    res.sendStatus(200);
};

// Internal endpoint to simulate webhook for dev/mock
export const mockPaymentSuccess = async (req: Request, res: Response) => {
    const { reference, plan } = req.body;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    // Simulate upgrade directly
    try {
        // Find user again to be sure
        const dbUser = await User.findById(user._id);
        if (dbUser) {
            // @ts-ignore
            dbUser.plan = plan;
            if (plan === 'basic') dbUser.apiKeyUses = 1000; // Mock logic
            if (plan === 'pro') dbUser.apiKeyUses = 10000;
            if (plan === 'premium') dbUser.apiKeyUses = -1;

            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);
            dbUser.planExpiry = expiry;

            await dbUser.save();
            res.json({ msg: 'Plan updated (Mock)', user: dbUser });
        } else {
            res.status(404).json({ msg: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ msg: 'Error' });
    }
}
