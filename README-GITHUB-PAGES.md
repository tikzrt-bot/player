# GitHub Pages 部署说明

## 问题说明

由于 IndexedDB 是**浏览器本地存储**，在本地管理员上传的音频只会保存在您的本地浏览器中，**不会自动同步到 GitHub Pages**。

## 解决方案：使用 JSON 配置文件

### 步骤 1：创建音频文件夹

在项目根目录创建 `audio` 文件夹：
```
audio-player/
├── audio/
│   ├── track1.mp3
│   ├── track2.mp3
│   └── ...
├── index.html
├── admin.html
├── playlist.json
└── ...
```

### 步骤 2：编辑 playlist.json

编辑 `playlist.json` 文件，添加您的音频信息：

```json
[
    {
        "name": "第一课：问候语",
        "url": "audio/lesson1.mp3",
        "duration": 180,
        "textData": [
            {"content": "Hello!"},
            {"content": "How are you?"},
            {"content": "I'm fine, thank you."}
        ]
    },
    {
        "name": "第二课：自我介绍",
        "url": "audio/lesson2.mp3",
        "duration": 240,
        "textData": [
            {"content": "My name is..."},
            {"content": "Nice to meet you."}
        ]
    }
]
```

### 字段说明：

- **name**: 音频显示名称
- **url**: 音频文件路径（相对于 index.html）
- **duration**: 音频时长（秒），可选
- **textData**: 文本内容数组，每行一个对象

### 步骤 3：获取音频时长

如果不确定音频时长，可以：
1. 在本地管理员上传音频
2. 查看显示的时长
3. 将时长添加到 playlist.json

或者使用以下代码在线获取：
```javascript
const audio = new Audio('audio/track1.mp3');
audio.addEventListener('loadedmetadata', () => {
    console.log('时长:', audio.duration, '秒');
});
```

### 步骤 4：提交到 GitHub

```bash
git add .
git commit -m "添加音频文件和播放列表"
git push
```

### 步骤 5：等待部署

GitHub Pages 会自动部署，通常需要 1-3 分钟。访问 https://tikzrt-bot.github.io/player/ 即可看到更新。

## 工作原理

- **用户界面** (index.html): 优先从 `playlist.json` 加载音频列表
- **管理员界面** (admin.html): 仍使用 IndexedDB，方便本地测试和管理
- **文本内容**: 直接写在 playlist.json 中，每行文本作为一个对象

## 注意事项

1. **音频文件大小**: GitHub 仓库有单文件 100MB 限制
2. **总大小限制**: GitHub 免费账户总存储限制为 1GB
3. **建议**: 音频文件使用 MP3 格式，比特率 128kbps 以平衡质量和大小

## 大文件解决方案

如果音频文件超过 100MB：

### 方案 1：使用 GitHub Releases
1. 在 GitHub 创建 Release
2. 上传大文件到 Release
3. 在 playlist.json 中使用 Release 下载链接

### 方案 2：使用外部 CDN
- Cloudinary (提供免费额度)
- jsDelivr + GitHub
- 其他云存储服务

### 方案 3：压缩音频
使用在线工具压缩音频：
- https://online-audio-converter.com/
- https://freeconvert.com/mp3-compressor

## 示例配置

完整示例请查看 `playlist.json` 文件。
