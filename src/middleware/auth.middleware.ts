import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface DecodedToken {
    id: string;
    role: string;
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
            User.findById(decoded.id).select('-password').then((user) => {
                if (!user) {
                    return res.status(401).json({ msg: 'User no longer exists' });
                }

                req.user = user;
                next();
            }).catch((error) => {
                console.error(error);
                res.status(500).json({ msg: 'Authentication lookup failed' });
            });
        } catch (error) {
            console.error(error);
            res.status(401).json({ msg: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ msg: 'Not authorized, no token' });
    }
};

export const admin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ msg: 'Not authorized as an admin' });
    }
};
