import mongoose, { Document, Schema } from 'mongoose';

export interface IAIMemory extends Document {
    prompt: string;
    response: string;
    embedding?: number[];
    type: 'trained' | 'semantic';
    createdAt: Date;
}

const AIMemorySchema: Schema = new Schema({
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    embedding: { type: [Number], index: '2dsphere' }, // Placeholder for vector index
    type: { type: String, enum: ['trained', 'semantic'], default: 'semantic' }
}, { timestamps: true });

export default mongoose.model<IAIMemory>('AIMemory', AIMemorySchema);
