// JWT 密钥（应存储在环境变量中）
export const JWT_SECRET = 'vikim294'

// 刷新token阈值 10 mins（如果 token 还剩 10 分钟过期，则刷新 token）
export const TOKEN_REFRESH_THRESHOLD = 10 * 60
// export const TOKEN_REFRESH_THRESHOLD = 59 * 60 // 如果还剩 59mins 则刷新
