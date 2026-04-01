import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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

export const getMe = async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
};
