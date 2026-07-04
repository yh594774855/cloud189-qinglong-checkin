require("dotenv").config();
const fs = require("fs");
const {
  CloudClient,
  FileTokenStore,
  logger: sdkLogger,
} = require("cloud189-sdk");
const recording = require("log4js/lib/appenders/recording");
const accounts = require("../accounts");
const { mask, delay, stableId } = require("./utils");
const push = require("./push");
const { log4js, cleanLogs, catLogs } = require("./logger");
const tokenDir = process.env.CLOUD189_TOKEN_DIR || ".token";
const tokenJson = process.env.CLOUD189_TOKEN_JSON;

sdkLogger.configure({
  isDebugEnabled: process.env.CLOUD189_VERBOSE === "1",
});

// 个人任务签到
const doUserTask = async (cloudClient, logger) => {
  const result = await cloudClient.userSign()
  const netdiskBonus = result.isSign? 0: result.netdiskBonus
  logger.info(`个人签到任务: 获得 ${netdiskBonus}M 空间`);
};

const prepareTokenFile = (tokenFile) => {
  if (!tokenJson) {
    return;
  }
  fs.mkdirSync(tokenDir, { recursive: true });
  JSON.parse(tokenJson);
  if (fs.existsSync(tokenFile)) {
    return;
  }
  fs.writeFileSync(tokenFile, tokenJson, { mode: 0o600 });
};

const runWithToken = async (userSizeInfoMap) => {
  const logger = log4js.getLogger("token-login");
  logger.addContext("user", "token");
  const before = Date.now();
  const tokenFile = `${tokenDir}/cloud189.json`;
  try {
    prepareTokenFile(tokenFile);
    logger.log("开始执行");
    const cloudClient = new CloudClient({
      token: new FileTokenStore(tokenFile),
    });
    const beforeUserSizeInfo = await cloudClient.getUserSizeInfo();
    userSizeInfoMap.set("token", {
      cloudClient,
      userSizeInfo: beforeUserSizeInfo,
      logger,
    });
    await doUserTask(cloudClient, logger);
  } finally {
    logger.log(
      `执行完毕, 耗时 ${((Date.now() - before) / 1000).toFixed(2)} 秒`
    );
  }
};

const run = async (userName, password, userSizeInfoMap, logger) => {
  if (userName && password) {
    const before = Date.now();
    const tokenFile = `${tokenDir}/${stableId(userName)}.json`;
    try {
      logger.log("开始执行");
      const cloudClient = new CloudClient({
        username: userName,
        password,
        token: new FileTokenStore(tokenFile),
      });
      const beforeUserSizeInfo = await cloudClient.getUserSizeInfo();
      userSizeInfoMap.set(userName, {
        cloudClient,
        userSizeInfo: beforeUserSizeInfo,
        logger,
      });
      await Promise.all([doUserTask(cloudClient, logger)]);
    } catch (e) {
      if (e.response) {
        logger.log(`请求失败: ${e.response.statusCode}, ${e.response.body}`);
      } else {
        logger.error(e);
      }
      if (e.code === "ECONNRESET" || e.code === "ETIMEDOUT") {
        logger.error("请求超时");
      }
      throw e;
    } finally {
      logger.log(
        `执行完毕, 耗时 ${((Date.now() - before) / 1000).toFixed(2)} 秒`
      );
    }
  }
};

// 开始执行程序
async function main() {
  //  用于统计实际容量变化
  const userSizeInfoMap = new Map();
  const errors = [];
  if (tokenJson) {
    try {
      await runWithToken(userSizeInfoMap);
    } catch (error) {
      errors.push({ userName: "token", error });
    }
  }
  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index];
    const { userName, password } = account;
    const userNameInfo = mask(userName);
    const logger = log4js.getLogger(stableId(userName));
    logger.addContext("user", userNameInfo);
    try {
      await run(userName, password, userSizeInfoMap, logger);
    } catch (error) {
      errors.push({ userName: userNameInfo, error });
    }
  }

  //数据汇总
  for (const [
    userName,
    { cloudClient, userSizeInfo, logger },
  ] of userSizeInfoMap) {
    const afterUserSizeInfo = await cloudClient.getUserSizeInfo();
    logger.log(
      `个人容量：⬆️  ${(
        (afterUserSizeInfo.cloudCapacityInfo.totalSize -
          userSizeInfo.cloudCapacityInfo.totalSize) /
        1024 /
        1024
      ).toFixed(2)}M/${(
        afterUserSizeInfo.cloudCapacityInfo.totalSize /
        1024 /
        1024 /
        1024
      ).toFixed(2)}G`,
      `家庭容量：⬆️  ${(
        (afterUserSizeInfo.familyCapacityInfo.totalSize -
          userSizeInfo.familyCapacityInfo.totalSize) /
        1024 /
        1024
      ).toFixed(2)}M/${(
        afterUserSizeInfo.familyCapacityInfo.totalSize /
        1024 /
        1024 /
        1024
      ).toFixed(2)}G`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      errors.map(({ userName, error }) => `${userName}: ${error.message || error}`).join("; ")
    );
  }
}

(async () => {
  try {
    await main();
    //等待日志文件写入
    await delay(1000);
  } finally {
    const logs = catLogs();
    const events = recording.replay();
    const content = events.map((e) => `${e.data.join("")}`).join("  \n");
    if (process.env.CLOUD189_DISABLE_PUSH !== "1") {
      await push("天翼云盘自动签到任务", logs + content);
    }
    recording.erase();
    if (process.env.CLOUD189_KEEP_LOGS !== "1") {
      cleanLogs();
    }
  }
})();
