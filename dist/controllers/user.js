import { Types } from 'mongoose';
import { getImgUrl, deleteImageByUrl } from '../services/index.js';
import { UserAccess, User, Payment } from '../models/index.js';
import { getFilterObj, t } from '../utils/index.js';
import { MAX_GALLERY_IMAGES } from '../utils/enums.js';
const userSelectFields = "_id fullName profileImg maritalStatus gender dob proffessionalDetails.highestQualification proffessionalDetails.profession otherDetails.caste otherDetails.subCaste currentPlan isVerified";
const currentPlanSelectFields = "-_id subscribedTo expiryDate";
function withHiddenFlag(profiles, hidden) {
    const hiddenIds = new Set(hidden.map(String));
    return profiles
        .filter(Boolean)
        .map(profile => ({ ...profile, isHidden: hiddenIds.has(String(profile._id)) }));
}
async function checkUserAccess(user, _id) {
    const isOwner = user._id.toString() === _id;
    if (isOwner || user.role.includes("admin"))
        return true;
    const hasAccess = user.role === "user" && user.currentPlan &&
        new Date(user.currentPlan.expiryDate).getTime() > new Date().getTime();
    if (!hasAccess)
        return false;
    const hasUnlockedAccess = await UserAccess.findOne({
        viewer: user._id,
        viewed: _id,
    }).select("_id").lean();
    return !!hasUnlockedAccess;
}
export const getUserDetails = async (c) => {
    const { _id } = c.req.valid("param");
    const user = c.get("user");
    const hasFullAccess = await checkUserAccess(user, _id);
    let select = "-refreshTokens -password -liked -hidden -verifiyOtp -role -brokerAppointed -approvalStatus -email";
    if (!hasFullAccess) {
        select += " -contactDetails -vedicHoroscope.vedicHoroscopePic";
    }
    const userDetails = await User.findOne({ _id })
        .select(select)
        .populate("currentPlan", currentPlanSelectFields)
        .lean();
    if (user.role === "user" && user._id !== _id && userDetails?.otherDetails?.caste === "14 oor kaikolar mudaliyar") {
        userDetails.contactDetails = {
            ...userDetails?.contactDetails,
            mobile: "restricted",
        };
    }
    return c.json({ ...userDetails, hasFullAccess });
};
export const getCurrentPlan = async (c) => {
    const { _id } = c.get("user");
    const user = await User.findById(_id)
        .select("email currentPlan")
        .populate("currentPlan", "amount subscribedTo expiryDate noOfProfilesCanView isAssisted assistedMonths createdAt")
        .lean();
    const unlockedCount = await UserAccess.countDocuments({
        viewer: user?._id,
        payment: user?.currentPlan?._id
    });
    const payload = {
        ...(user?.currentPlan || {}),
        unlockedCount,
    };
    return c.json(payload);
};
export const getMyPayments = async (c) => {
    const { _id } = c.get("user");
    const payments = await Payment.find({ user: _id })
        .select("_id amount subscribedTo noOfProfilesCanView isAssisted assistedMonths expiryDate createdAt orderId")
        .sort({ createdAt: -1, _id: -1 })
        .lean();
    return c.json(payments);
};
export const getPartnerPreferences = async (c) => {
    const { _id } = c.get("user");
    const user = await User.findById(_id)
        .select("partnerPreferences otherDetails.caste dob")
        .lean();
    const payload = {
        ...user?.partnerPreferences,
        caste: user?.partnerPreferences?.caste || (user?.otherDetails?.caste === "Don't wish to specify" ? "Any" : user?.otherDetails?.caste),
        dob: user?.dob,
    };
    return c.json(payload);
};
export const getMatches = async (c) => {
    const { limit, skip, ...rest } = c.req.valid("query") || { limit: 10, skip: 0 };
    const { _id } = c.get("user");
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const user = await User.findById(_id)
        .select("-refreshTokens -images -verifiyOtp -role -brokerAppointed")
        .lean();
    const payload = {};
    if (user?.gender === "Male") {
        payload.gender = "Female"; // ["Female", "Other"]
    }
    else if (user?.gender === "Female") {
        payload.gender = "Male"; // ["Female", "Other"]
    }
    const filters = getFilterObj({ ...rest, ...payload });
    const liked = user?.liked || [];
    const hidden = user?.hidden || [];
    const baseFilters = { ...filters, _id: { $nin: [...hidden, new Types.ObjectId(_id)] } };
    const select = userSelectFields.split(" ").reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
    const final = await User.aggregate([
        { $match: baseFilters },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: numSkip },
        { $limit: numLimit },
        { $project: select },
        {
            $lookup: {
                from: "payments",
                localField: "currentPlan",
                foreignField: "_id",
                as: "currentPlan",
                pipeline: [{
                        $project: {
                            _id: 0,
                            subscribedTo: 1,
                            expiryDate: 1,
                        }
                    }],
            }
        },
        {
            $unwind: {
                path: "$currentPlan",
                preserveNullAndEmptyArrays: true,
            }
        },
        {
            $addFields: {
                isLiked: {
                    $in: ["$_id", liked]
                },
            }
        }
    ]);
    return c.json(final);
};
export const getLikesList = async (c) => {
    const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 };
    const { _id } = c.get("user");
    const numLimit = Number(limit || 10);
    const numSkip = Number(skip || 0);
    const type = 'liked';
    const list = await User.findOne({ _id })
        .select(`${type} hidden`)
        .populate({
        path: type,
        select: userSelectFields,
        options: {
            sort: { _id: -1 },
            limit: numLimit,
            skip: numSkip,
        },
        populate: {
            path: "currentPlan",
            select: currentPlanSelectFields,
        },
    })
        .lean();
    // @ts-ignore
    return c.json(withHiddenFlag(list?.[type] || [], list?.hidden || []));
};
export const getUnlockedProfiles = async (c) => {
    const { _id, currentPlan } = c.get("user");
    if (!currentPlan)
        return c.json([]);
    const list = await UserAccess.find({ viewer: _id })
        .select("viewed")
        .populate({
        path: "viewed",
        select: userSelectFields,
        populate: {
            path: "currentPlan",
            select: currentPlanSelectFields,
        },
    })
        .sort({ createdAt: -1 })
        .lean();
    const seen = new Set();
    const profiles = list
        .map(item => item.viewed)
        .filter(profile => {
        const key = String(profile?._id ?? "");
        if (!key || seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    const me = await User.findById(_id).select("hidden").lean();
    const payload = withHiddenFlag(profiles, me?.hidden || []);
    return c.json(payload);
};
export const addLiked = async (c) => {
    const { userId } = c.req.valid("json");
    const { _id } = c.get("user");
    const type = "liked";
    const updateObj = { $addToSet: { [type]: userId } };
    await User.updateOne({ _id }, updateObj);
    return c.json({ message: t(c, "likedAdded") });
};
export const removeLiked = async (c) => {
    const { userId } = c.req.valid("json");
    const { _id } = c.get("user");
    const type = "liked";
    await User.updateOne({ _id }, { $pull: { [type]: userId } });
    return c.json({ message: t(c, "likedRemoved") });
};
export const getHiddenList = async (c) => {
    const { limit, skip } = c.req.valid("query") || { limit: 10, skip: 0 };
    const { _id } = c.get("user");
    const user = await User.findOne({ _id })
        .select("hidden")
        .populate({
        path: "hidden",
        select: userSelectFields,
        options: {
            sort: { _id: -1 },
            limit: Number(limit || 10),
            skip: Number(skip || 0),
        },
        populate: {
            path: "currentPlan",
            select: currentPlanSelectFields,
        },
    })
        .lean();
    return c.json(user?.hidden || []);
};
export const hideProfile = async (c) => {
    const { userId } = c.req.valid("json");
    const { _id } = c.get("user");
    if (userId === _id)
        return c.json({ message: t(c, "cannotHideSelf") }, 400);
    await User.updateOne({ _id }, { $addToSet: { hidden: userId } });
    return c.json({ message: t(c, "profileHidden") });
};
export const unhideProfile = async (c) => {
    const { userId } = c.req.valid("json");
    const { _id } = c.get("user");
    await User.updateOne({ _id }, { $pull: { hidden: userId } });
    return c.json({ message: t(c, "profileUnhidden") });
};
export const updateProfile = async (c) => {
    const payload = c.req.valid("json");
    const user = c.get("user");
    const _id = user.role === "user" ? user._id : payload._id;
    const newHoroscopePic = payload.vedicHoroscope?.vedicHoroscopePic;
    if (payload.profileImg || newHoroscopePic) {
        const owner = await User.findById(_id).select("images vedicHoroscope.vedicHoroscopePic").lean();
        if (!owner)
            return c.json({ message: t(c, "userNotFound") }, 404);
        const ownsProfileImg = !payload.profileImg || !!owner.images?.includes(payload.profileImg);
        const ownsHoroscopePic = !newHoroscopePic || owner.vedicHoroscope?.vedicHoroscopePic === newHoroscopePic;
        if (!ownsProfileImg || !ownsHoroscopePic)
            return c.json({ message: t(c, "imageNotFound") }, 400);
    }
    await User.updateOne({ _id }, payload);
    return c.json({ message: t(c, "userDetailsUpdated") });
};
export const imgUpload = async (c) => {
    const formData = c.req.valid("form");
    const user = c.get('user');
    const target = formData.target ?? (formData.isProfilePic ? "profile" : "gallery");
    const _id = user.role === "user" ? user._id.toString() : formData._id;
    if (!_id)
        return c.json({ message: t(c, "userNotFound") }, 400);
    const existing = await User.findById(_id).select("images profileImg vedicHoroscope.vedicHoroscopePic").lean();
    if (!existing)
        return c.json({ message: t(c, "userNotFound") }, 404);
    const galleryCount = existing.images?.length ?? 0;
    const images = target === "gallery" ? formData.images : formData.images.slice(0, 1);
    if (target === "gallery" && galleryCount + images.length > MAX_GALLERY_IMAGES) {
        return c.json({ message: t(c, "galleryLimitReached") }, 400);
    }
    const urls = await Promise.all(images.map(image => getImgUrl(image, _id)));
    if (target === "horoscope") {
        const previous = existing.vedicHoroscope?.vedicHoroscopePic;
        await User.updateOne({ _id }, { "vedicHoroscope.vedicHoroscopePic": urls[0] });
        if (previous && !existing.images?.includes(previous)) {
            await deleteImageByUrl(previous).catch(() => null);
        }
    }
    else if (target === "profile") {
        // A full gallery keeps its photos; the new profile picture lives outside it.
        const addToGallery = galleryCount < MAX_GALLERY_IMAGES;
        await User.updateOne({ _id }, {
            profileImg: urls[0],
            ...(addToGallery && { $push: { images: urls[0] } }),
        });
        const previous = existing.profileImg;
        if (previous && !existing.images?.includes(previous) && previous !== existing.vedicHoroscope?.vedicHoroscopePic) {
            await deleteImageByUrl(previous).catch(() => null);
        }
    }
    else {
        await User.updateOne({ _id }, { $push: { images: { $each: urls } } });
    }
    return c.json({ message: t(c, "userImageUploaded"), urls });
};
export const imgDelete = async (c) => {
    const { url, _id: targetId } = c.req.valid("json");
    const user = c.get('user');
    const _id = user.role === "user" ? user._id.toString() : targetId;
    if (!_id)
        return c.json({ message: t(c, "userNotFound") }, 400);
    const owner = await User.findById(_id).select("images profileImg vedicHoroscope.vedicHoroscopePic").lean();
    const isOwned = !!owner && (owner.images?.includes(url) ||
        owner.profileImg === url ||
        owner.vedicHoroscope?.vedicHoroscopePic === url);
    if (!isOwned)
        return c.json({ message: t(c, "imageNotFound") }, 404);
    const update = { $pull: { images: url } };
    const unset = {};
    if (owner.profileImg === url)
        unset.profileImg = "";
    if (owner.vedicHoroscope?.vedicHoroscopePic === url)
        unset["vedicHoroscope.vedicHoroscopePic"] = "";
    if (Object.keys(unset).length)
        update.$unset = unset;
    await User.updateOne({ _id }, update);
    await deleteImageByUrl(url).catch(() => null);
    return c.json({ message: t(c, "imageDeleted") });
};
export const unlockProfile = async (c) => {
    const { _id } = c.req.valid("json");
    const user = c.get("user");
    const hasFullAccess = await checkUserAccess(user, _id);
    if (hasFullAccess)
        return c.json({ message: t(c, "alreadyFullAccess") });
    if (user.currentPlan.noOfProfilesCanView !== 999) {
        const unlockedCount = await UserAccess.countDocuments({
            viewer: user._id,
            payment: user.currentPlan._id
        });
        if (unlockedCount >= user.currentPlan.noOfProfilesCanView)
            return c.json({ message: t(c, "unlockLimitReached") }, 400);
    }
    await UserAccess.create({
        viewer: user._id,
        viewed: _id,
        payment: user.currentPlan._id,
        expiresAt: new Date(user.currentPlan.expiryDate),
    });
    return c.json({ message: t(c, "profileUnlocked") });
};
