# 题库网站项目

<img src="https://img.shields.io/badge/Next.js-14-blue" alt="Next.js 14" />
<img src="https://img.shields.io/badge/React-18-blue" alt="React 18" />
<img src="https://img.shields.io/badge/License-MIT-green" alt="License MIT" />

## 📝 项目概述

一个集题库管理、AI辅助解析和模拟训练于一体的在线学习平台。用户可以上传题库文件，浏览题目和解析，进行模拟训练，系统会自动记录错题次数和错误频率。

## ✨ 主要功能

### 1. 题库上传
- 网站首页提供简洁直观的题库上传界面
- 支持多种格式的题库文件上传
- 自动识别题库分类

### 2. 题库浏览
- 默认展示所有上传的题目
- AI自动分析无答案的题目并给出答案及解析
- 每道题下方显示详细解析
- 错题次数统计显示（颜色深浅标记错误频率）

### 3. 分类导航
- 左上角设置分类导航按钮
- 自动识别题库分类并创建对应板块
- 点击分类可跳转至该分类的题目列表

### 4. 模拟训练
- 用户可选择默认10题或自定义题目数量
- 随机抽取题目组成训练集
- 完成后提交显示正误结果
- 显示每道题的答案和解析
- 错题自动记录并更新题库中的错误统计

## 🔧 技术栈

- **前端框架**: React, Next.js
- **数据请求**: Axios
- **文件处理**: formidable, xlsx
- **AI接口**: 外部AI服务进行题目解析和分类

## 📋 系统要求

- Node.js 14.x 或更高版本
- npm 6.x 或更高版本

## 🚀 安装运行

1. 克隆该项目
```bash
git clone https://github.com/Billy-cpu0366/question-bank.git
cd question-bank
```

2. 安装依赖
```bash
npm install
```

3. 运行开发服务器
```bash
npm run dev
```

4. 打开浏览器访问 http://localhost:3000

## 📦 构建生产版本

```bash
npm run build
npm start
```

## 🧪 支持的文件格式

- Excel文件 (.xlsx, .xls)
- 文本文件 (.txt)

## 🔒 环境变量配置

项目根目录创建`.env.local`文件，配置以下变量:

```
AI_API_KEY=your_api_key
AI_API_URL=your_api_url
```

## 📁 项目结构

```
题库网站/
├── app/                # 主应用目录
│   ├── api/            # API路由
│   ├── components/     # React组件
│   ├── models/         # 数据模型
│   ├── utils/          # 工具函数
│   ├── browse/         # 题库浏览页面
│   ├── simulate/       # 模拟训练页面
│   ├── globals.css     # 全局样式
│   ├── layout.js       # 布局组件
│   └── page.js         # 主页组件
├── public/             # 静态资源
│   └── uploads/        # 上传文件存储
├── package.json        # 项目依赖
└── next.config.js      # Next.js配置
```

## 📝 使用说明

1. **题库上传**
   - 在首页点击"上传题库"按钮
   - 选择支持的文件格式(.txt, .xlsx, .xls)
   - 等待上传和处理完成

2. **题库浏览**
   - 点击"浏览题库"导航到题库页面
   - 使用左侧分类导航筛选题目
   - 点击"显示答案"查看解析

3. **模拟训练**
   - 点击"模拟训练"导航到训练页面
   - 设置题目数量并开始训练
   - 完成作答后提交查看结果和解析

## 🔑 API参考

项目使用外部AI API进行题目解析:

```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{ 
    "model": "model_name", 
    "messages": [
      {"role": "user", "content": "问题内容"}
    ] 
  }'
```

## �� 许可证

MIT License
