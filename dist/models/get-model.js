import { Model } from 'mongoose';
import { Admin } from './admin.js';
import { User } from './user.js';
export function getModel(role) {
    return role === "user" ? User : Admin;
}
