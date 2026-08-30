import { z } from "zod";
import { approvalStatuses, genders, maritalStatuses } from "./enums.js";
import educationLevels from "../assets/v1/education-levels.json" with { type: "json" };
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function regexQuery(val, regex = false) {
    if (!regex)
        return typeof val === "string" ? val : { $in: val };
    const pattern = Array.isArray(val)
        ? val.map(escapeRegex).join("|")
        : escapeRegex(val);
    return { $regex: pattern, $options: "i" };
}
function strOrArr(by, possibleLen) {
    const parsed = typeof by === "string" ?
        by?.includes("[")
            ? JSON.parse(by)
            : by.includes(",")
                ? by.split(",")
                : by
        : by;
    if (typeof parsed === "string")
        return parsed;
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.length < possibleLen) {
        return parsed;
    }
    return false;
}
const setFilter = (filter, key, value, possibleLen = Infinity, regex = false) => {
    const parsed = strOrArr(value, possibleLen);
    if (parsed && parsed !== "Any") {
        filter[key] = regexQuery(parsed, regex);
        return true;
    }
    return false;
};
export function getFilterObj(obj) {
    const { gender, isMarried, salaryRange, ageRange, approvalStatus, minQualification, sector, profession, minSalary, motherTongue, rasi, lagna, nakshatra, maritalStatus, isBlocked, isDeleted, caste, subCaste, religion, minAge, maxAge, createdBy, fullName, email, mobile, createdAtFrom, createdAtTo, } = obj;
    const filter = {
        role: 'user',
        approvalStatus: 'approved',
        isBlocked: isBlocked ?? false,
        isDeleted: isDeleted ?? false,
        isMarried: isMarried ?? false,
    };
    const approvalStatusApplied = setFilter(filter, "approvalStatus", approvalStatus, approvalStatuses.length);
    if (approvalStatus && !approvalStatusApplied) {
        delete filter.approvalStatus;
    }
    if (fullName) {
        filter.fullName = regexQuery(fullName, true);
    }
    if (email) {
        filter.email = regexQuery(email, true);
    }
    if (mobile) {
        filter["contactDetails.mobile"] = regexQuery(mobile, true);
    }
    setFilter(filter, "gender", gender, genders.length);
    setFilter(filter, "maritalStatus", maritalStatus, maritalStatuses.length);
    setFilter(filter, "vedicHoroscope.nakshatra", nakshatra, 27);
    setFilter(filter, "vedicHoroscope.rasi", rasi, 12);
    setFilter(filter, "vedicHoroscope.lagna", lagna, 12);
    if (caste) {
        const casteParsed = strOrArr(caste, Infinity);
        if (casteParsed) {
            const casteList = Array.isArray(casteParsed) ? casteParsed : [casteParsed];
            const wantsEmpty = casteList.some(c => c === "Any" || c === "Don't wish to specify");
            filter["otherDetails.caste"] = wantsEmpty
                ? { $in: [null, "", "Any", "Don't wish to specify"] }
                : regexQuery(casteParsed, true);
        }
    }
    setFilter(filter, "otherDetails.subCaste", subCaste, Infinity, true);
    setFilter(filter, "otherDetails.religion", religion, Infinity, true);
    setFilter(filter, "otherDetails.motherTongue", motherTongue, Infinity, true);
    setFilter(filter, "proffessionalDetails.sector", sector);
    setFilter(filter, "proffessionalDetails.profession", profession);
    if (isBlocked || isDeleted) {
        delete filter.approvalStatus;
    }
    if (salaryRange) {
        const salaryList = {
            'below_20000': { $lt: 20000 },
            '20000_30000': { $gte: 20000, $lte: 30000 },
            '30000_40000': { $gte: 30000, $lte: 40000 },
            '40000_50000': { $gte: 40000, $lte: 50000 },
            'above_50000': { $gt: 50000 },
        };
        if (salaryList[salaryRange]) {
            filter["proffessionalDetails.salary"] = salaryList[salaryRange];
        }
    }
    if (minSalary) {
        filter["proffessionalDetails.salary"] = { $gte: Number(minSalary) };
    }
    if (minQualification && minQualification !== "Any" && minQualification !== educationLevels[0]) {
        const applicableQualification = educationLevels.slice(educationLevels.indexOf(minQualification));
        filter["proffessionalDetails.highestQualification"] = {
            $in: applicableQualification
        };
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    if (ageRange) {
        const ageList = {
            'below_25': { $gte: new Date(y - 25, m, d) },
            '25_30': { $gte: new Date(y - 30, m, d), $lt: new Date(y - 25, m, d) },
            '30_40': { $gte: new Date(y - 40, m, d), $lt: new Date(y - 30, m, d) },
            'above_40': { $lt: new Date(y - 40, m, d) },
        };
        if (ageList[ageRange]) {
            filter.dob = ageList[ageRange];
        }
    }
    if (minAge) {
        filter.dob = { ...filter.dob, $lte: new Date(y - minAge, m, d) };
    }
    if (maxAge) {
        filter.dob = { ...filter.dob, $gte: new Date(y - maxAge, m, d) };
    }
    if (createdBy) {
        filter.createdBy = createdBy;
    }
    if (createdAtFrom) {
        const startOfDay = new Date(createdAtFrom);
        startOfDay.setHours(0, 0, 0, 0);
        filter.createdAt = { ...filter.createdAt, $gte: startOfDay };
    }
    if (createdAtTo) {
        const endOfDay = new Date(createdAtTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt = { ...filter.createdAt, $lte: endOfDay };
    }
    return filter;
}
