import { randFullName, randEmail, randPassword, randNumber, randPhoneNumber, randStreetAddress, randBetweenDate, randCompanyName, randWord, randBoolean, randText, rand, } from "@ngneat/falso";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import educationLevels from "../assets/v1/education-levels.json" with { type: "json" };
import professions from "../assets/v1/professions.json" with { type: "json" };
import religions from "../assets/v1/religions.json" with { type: "json" };
import languages from "../assets/v1/languages.json" with { type: "json" };
import castesMap from "../assets/v1/caste-map.json" with { type: "json" };
import nakshatra from "../assets/v1/nakshatra.json" with { type: "json" };
import sectors from "../assets/v1/sectors.json" with { type: "json" };
import castes from "../assets/v4/castes.json" with { type: "json" };
import raasi from "../assets/v1/raasi.json" with { type: "json" };
import { approvalStatuses, maritalStatuses, genders } from "../utils/index.js";
import { getImgUrl } from "../services/cloudinary.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesRoot = join(__dirname, "../../../images");
const generateRandomUser = async () => {
    const gender = rand(genders);
    const noOfBrothers = randNumber({ min: 0, max: 5 });
    const noOfSisters = randNumber({ min: 0, max: 5 });
    const birthOrder = randNumber({ min: 1, max: noOfBrothers + noOfSisters + 1 });
    const minAge = randNumber({ min: 20, max: 30 });
    const maxAge = randNumber({ min: minAge, max: 45 });
    const genderFolder = gender === "Male" ? "male" : "female";
    const imgNum = randNumber({ min: 1, max: 40 });
    const imgPath = join(imagesRoot, genderFolder, `${genderFolder}${imgNum}.jpg`);
    const imgBuffer = await readFile(imgPath);
    const imgBlob = new Blob([imgBuffer], { type: "image/jpeg" });
    const profileImg = await getImgUrl(imgBlob);
    const sector = rand(sectors);
    const profession = sector === "Unemployed" ? "Unemployed" : rand(professions);
    const salary = sector === "Unemployed" ? 0 : randNumber({ min: 10000, max: 150000 });
    const caste = rand(castes.slice(1, 14));
    const found = castesMap[caste] || [];
    const subCaste = rand(found) || "";
    const now = new Date();
    const minDOB = new Date(now.getFullYear() - 40, now.getMonth(), now.getDate());
    const maxDOB = new Date(now.getFullYear() - 21, now.getMonth(), now.getDate());
    const dob = randBetweenDate({ from: minDOB, to: maxDOB });
    return {
        fullName: randFullName({ gender: gender.toLowerCase(), withAccents: false }),
        email: randEmail(),
        password: randPassword(),
        maritalStatus: rand(maritalStatuses),
        isMarried: randBoolean(),
        gender,
        dob,
        contactDetails: {
            mobile: randPhoneNumber({ countryCode: "IN" }),
            address: randStreetAddress(),
        },
        profileImg,
        proffessionalDetails: {
            highestQualification: rand(educationLevels),
            qualifications: randWord({ length: 10 }).join(' '),
            companyName: sector === "Unemployed" ? "" : randCompanyName(),
            profession,
            sector,
            salary,
        },
        familyDetails: {
            fatherName: randFullName({ gender: 'male', withAccents: false }),
            motherName: randFullName({ gender: 'female', withAccents: false }),
            noOfBrothers,
            noOfSisters,
            birthOrder,
            isFatherAlive: randBoolean(),
            isMotherAlive: randBoolean(),
        },
        approvalStatus: rand(approvalStatuses),
        vedicHoroscope: {
            nakshatra: rand(nakshatra).split(" (")[0],
            rasi: rand(raasi).split(" (")[0],
            lagna: rand(raasi).split(" (")[0],
        },
        partnerPreferences: {
            minAge,
            maxAge,
            caste,
            subCaste,
            religion: rand(religions),
            minSalary: randNumber({ min: 30000, max: 100000 }),
            minQualification: rand(educationLevels),
            profession: rand(professions),
            motherTongue: rand(languages),
            location: randStreetAddress(),
            expectation: randText({ charCount: 16 }),
            maritalStatus: rand(maritalStatuses),
        },
        otherDetails: {
            motherTongue: rand(languages),
            religion: rand(religions),
            subCaste,
            caste,
        },
    };
};
export const randomUsers = () => Promise.all(Array.from({ length: 200 }, () => generateRandomUser()));
