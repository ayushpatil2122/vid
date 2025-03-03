import bcrypt from 'bcrypt';

export const hashPassword = async (password) => {
    if (!password) {
        throw new Error("Password is required.");
    }

    // Salt rounds for bcrypt
    const saltRounds = 10;

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Password hashing failed.");
    }
};

export const comparePasswords = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        console.error("Error comparing passwords:", error);
        throw new Error("Password comparison failed.");
    }
};
