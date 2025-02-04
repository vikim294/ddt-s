import pool from "../utils/db.js"

/**
 * 根据用户id 从数据库 获取用户信息
 */
export const getUserById = async (userId) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, name FROM user
            WHERE id = '${userId}'
        `)

        if (rows.length > 0) {
            return rows[0]
        }
        else {
            throw new Error("获取用户信息失败: 数据为空");
        }
    } catch (err) {
        console.error('获取用户信息失败', err)
    }
}