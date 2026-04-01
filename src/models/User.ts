import mongoose, { Document, Schema } from 'mongoose';


export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: 'user' | 'admin';
    plan: 'free' | 'basic' | 'pro' | 'premium';
    planExpiry?: Date;
    apiKey: string;
    apiKeyUses: number; // -1 for unlimited
    apiUsage: number;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['free', 'basic', 'pro', 'premium'], default: 'free' },
    planExpiry: { type: Date },
    apiKey: { type: String, required: true, unique: true },
    apiKeyUses: { type: Number, default: 30 },
    apiUsage: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
