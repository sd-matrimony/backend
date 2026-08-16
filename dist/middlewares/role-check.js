export function roleCheck(roles) {
    return async (c, next) => {
        const user = c.get('user');
        if (!roles.includes(user.role)) {
            return c.json({ error: "Access denied" }, 403);
        }
        await next();
    };
}
export default roleCheck;
