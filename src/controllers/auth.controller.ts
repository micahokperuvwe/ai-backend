import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const buildAuthResponse = (user: IUser) => {
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });

    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            apiKey: user.apiKey,
            plan: user.plan
        }
    };
};

const createUser = async (
    name: string,
    email: string,
    password: string,
    role: 'user' | 'admin'
) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return { error: 'User already exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const apiKey = uuidv4();

    const planExpiry = new Date();
    planExpiry.setDate(planExpiry.getDate() + 30);

    const newUser = new User({
        name,
        email,
        password: hashedPassword,
        apiKey,
        plan: 'premium',
        apiKeyUses: -1,
        planExpiry,
        role
    });

    await newUser.save();
    return { user: newUser };
};

export const register = async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    try {
        const result = await createUser(name, email, password, 'user');
        if (result.error) return res.status(400).json({ msg: result.error });

        res.status(201).json(buildAuthResponse(result.user!));
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password!);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                apiKey: user.apiKey,
                plan: user.plan
            }
        });

    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ msg: 'Google credential is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ msg: 'Google login is not configured' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload?.email;

        if (!email) {
            return res.status(400).json({ msg: 'Google account email not available' });
        }

        let user = await User.findOne({ email });
        if (!user) {
            const generatedPassword = crypto.randomUUID();
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);
            const apiKey = uuidv4();
            const planExpiry = new Date();
            planExpiry.setDate(planExpiry.getDate() + 30);

            user = await User.create({
                name: payload?.name || email.split('@')[0],
                email,
                password: hashedPassword,
                apiKey,
                plan: 'premium',
                apiKeyUses: -1,
                planExpiry,
                role: 'user'
            });
        }

        res.json(buildAuthResponse(user));
    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(401).json({ msg: 'Google authentication failed' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
};
