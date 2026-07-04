function loadAccountsFromEnv() {
    if (process.env.CLOUD189_TOKEN_JSON) {
        return []
    }

    let accounts = []

    // 读取旧版环境变量
    if(process.env.TY_ACCOUNTS) {
        try {
            accounts = JSON.parse(process.env.TY_ACCOUNTS)
        } catch (error) {
            throw new Error(`TY_ACCOUNTS 不是合法 JSON: ${error.message}`)
        }
    } else {
        // 从环境变量中读取账号，支持任意数量
        let index = 1
        while (true) {
            const userName = process.env[`TY_USERNAME_${index}`]
            const password = process.env[`TY_PASSWORD_${index}`]
            if (!userName || !password) {
                break
            }
            accounts.push({
                userName,
                password
            })
            index++
        }
    }

    if (!Array.isArray(accounts)) {
        throw new Error("TY_ACCOUNTS 必须是数组，例如 [{\"userName\":\"手机号\",\"password\":\"密码\"}]")
    }

    accounts.forEach((account, index) => {
        if (!account.userName || !account.password) {
            throw new Error(`第 ${index + 1} 个账号缺少 userName 或 password`)
        }
    })

    if (accounts.length === 0) {
        throw new Error("未配置天翼云盘账号，请设置 TY_ACCOUNTS 或 TY_USERNAME_1/TY_PASSWORD_1")
    }

    return accounts
}

const accounts = loadAccountsFromEnv()
module.exports = accounts
