const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { CloudClient, FileTokenStore } = require("cloud189-sdk");

const tokenDir = process.env.CLOUD189_TOKEN_DIR || path.join(process.cwd(), ".token");
const tokenFile = process.env.CLOUD189_TOKEN_FILE || path.join(tokenDir, "cloud189.json");
const repo = process.env.GITHUB_REPOSITORY || "yh594774855/cloud189-qinglong-checkin";

fs.mkdirSync(tokenDir, { recursive: true });

const qrImageUrl = (value) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(value)}`;

async function main() {
  console.log("准备生成天翼云盘扫码登录二维码...");
  const cloudClient = new CloudClient({
    token: new FileTokenStore(tokenFile),
    onQRCodeReady: (qrValue) => {
      console.log("请用天翼云盘 App 扫码确认登录：");
      console.log(qrImageUrl(qrValue));
      console.log("二维码内容已生成，等待扫码确认...");
    },
    qrLoginOptions: {
      pollInterval: 2000,
      timeout: 180000,
    },
  });

  await cloudClient.getUserSizeInfo();
  const tokenJson = fs.readFileSync(tokenFile, "utf8");
  JSON.parse(tokenJson);

  const result = spawnSync("gh", ["secret", "set", "CLOUD189_TOKEN_JSON", "--repo", repo], {
    input: tokenJson,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error("写入 GitHub Secret 失败");
  }

  console.log(`已写入 GitHub Secret：${repo} / CLOUD189_TOKEN_JSON`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
