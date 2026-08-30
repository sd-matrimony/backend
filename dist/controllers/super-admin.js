import { Payment, User, Admin } from "../models/index.js";
import { getFilterObj } from "../utils/user-filter-obj.js";
import { hashPassword } from "../utils/password.js";
import { onPaid } from "./payment.js";
const planSelectFields = "_id amount subscribedTo expiryDate noOfProfilesCanView isAssisted assistedMonths createdAt";
const userSelectFields = "_id fullName email profileImg dob contactDetails.mobile otherDetails.caste otherDetails.subCaste proffessionalDetails.salary";
export async function getUsersCount(c) {
    const queries = c.req.valid("query") || { limit: 10, skip: 0 };
    const filters = getFilterObj(queries);
    const count = await User.countDocuments(filters);
    return c.json({ count });
}
export async function getPaidUsers(c) {
    const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 };
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const users = await Payment.find({ expiryDate: { $gte: new Date() } })
        .select(planSelectFields)
        .populate("user", userSelectFields)
        .limit(numLimit)
        .skip(numSkip)
        .sort({ createdAt: -1 })
        .lean();
    const final = users.map(({ createdAt, ...user }) => ({
        ...user,
        assistedExpire: new Date(new Date(createdAt).setMonth(createdAt.getMonth() + user.assistedMonths)).toISOString()
    }));
    return c.json(final);
}
export async function getAssistedSubscribedUsers(c) {
    const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 };
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const users = await Payment.find({
        expiryDate: { $gte: new Date() },
        isAssisted: true,
    })
        .select(planSelectFields)
        .populate("user", userSelectFields)
        .limit(numLimit)
        .skip(numSkip)
        .sort({ createdAt: -1 })
        .lean();
    const final = users.map(({ createdAt, ...user }) => ({
        ...user,
        assistedExpire: new Date(new Date(createdAt).setMonth(createdAt.getMonth() + user.assistedMonths)).toISOString()
    }));
    return c.json(final);
}
export async function getUsersAllPayments(c) {
    const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 };
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const paidUsers = await Payment.aggregate([
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $unwind: '$user',
        },
        {
            $match: {
                'user.currentPlan': { $ne: null },
            },
        },
        {
            $group: {
                _id: '$user._id',
                user: {
                    $first: {
                        _id: '$user._id',
                        dob: '$user.dob',
                        email: '$user.email',
                        gender: '$user.gender',
                        fullName: '$user.fullName',
                        profileImg: '$user.profileImg',
                        currentPlan: '$user.currentPlan',
                        maritalStatus: '$user.maritalStatus',
                    },
                },
                payments: {
                    $push: {
                        _id: '$_id',
                        amount: '$amount',
                        expiryDate: '$expiryDate',
                        isAssisted: '$isAssisted',
                        subscribedTo: '$subscribedTo',
                        assistedMonths: '$assistedMonths',
                    },
                },
            },
        },
        { $skip: numSkip },
        { $limit: numLimit },
        { $sort: { createdAt: -1 } },
    ]);
    return c.json(paidUsers);
}
export async function getUsersByCreatedBy(c) {
    const { limit, skip, createdAtToday, createdBy } = c.req.valid("query") || { limit: 10, skip: 0 };
    const { _id } = c.get("user");
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const payload = {
        createdBy: createdBy || _id
    };
    if (createdAtToday) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        payload.createdAt = {
            $gte: startOfToday,
            $lte: endOfToday,
        };
    }
    const users = await User.find(payload)
        .select(userSelectFields)
        .limit(numLimit)
        .skip(numSkip)
        .sort({ createdAt: -1 })
        .lean();
    return c.json(users);
}
export async function getUsersGroupedByAdminCount(c) {
    const { type, includeByAdmin, gender } = c.req.valid("query");
    const groupKey = type === "date"
        ? { $dateToString: { format: "%d-%m-%Y", date: "$createdAt" } }
        : "$otherDetails.caste";
    const matchStage = {
        ...(gender ? { gender } : {}),
    };
    if (includeByAdmin) {
        const result = await User.aggregate([
            ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
            {
                $group: {
                    _id: {
                        createdBy: { $ifNull: ["$createdBy", null] },
                        key: {
                            $ifNull: [groupKey, "Unknown"],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $group: {
                    _id: "$_id.createdBy",
                    counts: {
                        $push: {
                            k: "$_id.key",
                            v: "$count",
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "admins",
                    localField: "_id",
                    foreignField: "_id",
                    as: "adminDetails",
                },
            },
            {
                $unwind: {
                    path: "$adminDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 1,
                    fullName: "$adminDetails.fullName",
                    email: "$adminDetails.email",
                    data: {
                        $arrayToObject: {
                            $filter: {
                                input: "$counts",
                                as: "item",
                                cond: {
                                    $and: [
                                        { $ne: ["$$item.k", null] },
                                        { $ne: ["$$item.k", undefined] },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        ]);
        return c.json(result);
    }
    const result = await User.aggregate([
        ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
        {
            $group: {
                _id: { $ifNull: [groupKey, "Unknown"] },
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: null,
                counts: { $push: { k: "$_id", v: "$count" } },
            },
        },
        {
            $project: {
                _id: 1,
                data: { $arrayToObject: "$counts" },
            },
        },
    ]);
    return c.json(result);
}
export async function getUsersGroupedCount(c) {
    const { date, caste } = c.req.valid("query");
    const match = {
        ...(date && {
            createdAt: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
        }),
        ...(caste && {
            "otherDetails.caste": caste,
        }),
    };
    const result = await User.aggregate([
        {
            $match: match,
        },
        {
            $group: {
                _id: {
                    createdBy: "$createdBy",
                },
                users: {
                    $push: {
                        _id: '$_id',
                        fullName: '$fullName',
                        profileImg: '$profileImg',
                        maritalStatus: '$maritalStatus',
                        isDeleted: '$isDeleted',
                        isBlocked: '$isBlocked',
                    },
                },
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: "admins",
                localField: "_id.createdBy",
                foreignField: "_id",
                as: "adminDetails"
            }
        },
        {
            $unwind: {
                path: "$adminDetails",
                preserveNullAndEmptyArrays: true,
            }
        },
        {
            $project: {
                _id: "$_id.createdBy",
                fullName: "$adminDetails.fullName",
                email: "$adminDetails.email",
                created: "$count",
            }
        }
    ]);
    return c.json(result);
}
export async function getUsersGroupedList(c) {
    const { date, caste, limit, skip, createdBy } = c.req.valid("query");
    const match = {
        ...(date && {
            createdAt: {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
        }),
        ...(caste && {
            "otherDetails.caste": caste,
        }),
        createdBy: createdBy || null,
    };
    const numLimit = Number(limit || 50);
    const numSkip = Number(skip || 0);
    const result = await User.find(match)
        .select("fullName profileImg maritalStatus isDeleted isBlocked")
        .limit(numLimit)
        .skip(numSkip)
        .lean();
    return c.json(result);
}
export async function getAdmins(c) {
    const admins = await Admin.find()
        .select("_id fullName email isDeleted contactDetails")
        .lean();
    return c.json(admins);
}
export async function getUsersInvitations(c) {
    const { limit, skip, ...filters } = c.req.valid("query") || { limit: 50, skip: 0 };
    const numLimit = Number(limit || 50);
    const numSkip = Number(skip || 0);
    const payload = !!filters ? getFilterObj(filters) : {
        $and: [
            { $or: [{ email: { $exists: false } }, { email: null }] },
            { $or: [{ invited: { $exists: false } }, { invited: false }] }
        ],
    };
    const users = await User.find(payload)
        .select("_id fullName email profileImg contactDetails.mobile dob otherDetails.caste currentPlan")
        .populate("currentPlan", "subscribedTo expiryDate")
        .limit(numLimit)
        .skip(numSkip)
        .sort({ createdAt: -1 })
        .lean();
    return c.json(users);
}
export async function removeUserPlan(c) {
    const { _id } = c.req.valid("param");
    await User.updateOne({ _id }, { $unset: { currentPlan: 1 } });
    return c.json({ message: "Subscription removed successfully" });
}
export async function updateInvited(c) {
    const { _id } = c.req.valid("param");
    await User.updateOne({ _id }, { invited: true });
    return c.json({ message: "User invited successfully" });
}
export async function createAdmin(c) {
    const { email, password, ...rest } = c.req.valid("json");
    const findBy = {};
    if (email && rest?.contactDetails?.mobile) {
        findBy.$or = [{ email }, { "contactDetails.mobile": rest.contactDetails.mobile }];
    }
    else if (email) {
        findBy.email = email;
    }
    else {
        findBy["contactDetails.mobile"] = rest?.contactDetails?.mobile;
    }
    const adminExist = await Admin.findOne(findBy)
        .select("_id")
        .lean();
    if (adminExist)
        return c.json({ message: "Admin already exists" }, 400);
    const hashedPass = await hashPassword(password);
    const admin = new Admin({
        ...rest,
        email: email || undefined,
        password: hashedPass,
        approvalStatus: "approved",
        isVerified: true,
        contactDetails: {
            ...rest?.contactDetails,
            mobile: rest?.contactDetails?.mobile || undefined,
        },
    });
    await admin.save();
    return c.json({ message: "Admin created successfully" });
}
export async function updateAdmin(c) {
    const { _id } = c.req.valid("param");
    const rest = c.req.valid("json");
    if (rest.password) {
        rest.password = await hashPassword(rest.password);
    }
    await Admin.updateOne({ _id }, rest);
    return c.json({ message: "Admin details updated successfully" });
}
export async function resetPass(c) {
    const { password } = c.req.valid("json");
    const { _id } = c.req.valid("param");
    const hashedPass = await hashPassword(password);
    await User.updateOne({ _id }, { password: hashedPass });
    return c.json({ message: "Password reset successfully" });
}
export async function getUserCurrentPlan(c) {
    const { _id } = c.req.valid("param");
    const user = await User.findById(_id)
        .select("currentPlan")
        .populate("currentPlan", "subscribedTo expiryDate")
        .lean();
    if (!user)
        return c.json({ message: "User not found" }, 404);
    return c.json(user.currentPlan ?? null);
}
export async function makePaymentForUser(c) {
    const { _id, ...body } = c.req.valid("json");
    const res = await onPaid({ _id, role: "user" }, { ...body, orderId: `by-admin-${Date.now()}` });
    return c.json(res);
}
function flattenForSet(obj, prefix = "") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(result, flattenForSet(value, fullKey));
        }
        else if (value !== undefined) {
            result[fullKey] = value;
        }
    }
    return result;
}
export async function updateUserCritical(c) {
    const { _id } = c.req.valid("param");
    const { email, mobile, salary } = c.req.valid("json");
    const user = await User.findById(_id).select("_id");
    if (!user)
        return c.json({ message: "User not found" }, 404);
    const update = {};
    if (email !== undefined)
        update.email = email;
    if (mobile !== undefined)
        update["contactDetails.mobile"] = mobile;
    if (salary !== undefined)
        update["proffessionalDetails.salary"] = salary;
    await User.updateOne({ _id }, { $set: update });
    return c.json({ message: "User details updated successfully" });
}
export async function bulkUpdateUsers(c) {
    const updates = c.req.valid("json");
    const bulkOps = updates.map(({ _id, ...rest }) => ({
        updateOne: {
            filter: { _id },
            update: { $set: flattenForSet(rest) },
        }
    }));
    await User.bulkWrite(bulkOps);
    return c.json({ message: `${updates.length} user(s) updated successfully` });
}
