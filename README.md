# medical-training-demo


```
# 医疗临床问诊模拟实训与智能评估系统 🩺

本项目是一个基于 **React + Vite** 前端与 **FastAPI (Python)** 后端的全栈 Web 应用，旨在为医学生提供临床问诊模拟实训及智能评估功能。

---

## 🛠️ 本地开发环境运行指南

为了方便您在本地运行并查看项目，请按照以下步骤分别启动后端和前端服务。

### 1. 后端服务启动 (FastAPI)

后端代码位于 `backend` 目录下。请确保您的电脑已安装 Python 3.10+。

1. **进入后端目录**：
   ```bash
   cd backend
```

1. **安装依赖**：

   - 如果您在 Linux / WSL 环境下，且环境提示被外部管理，可以使用以下命令强行安装：

     巴什

     ```
     pip install -r requirements.txt --break-system-packages
     ```

   - 如果您在 Windows 或已激活虚拟环境，直接运行：

     巴什

     ```
     pip install -r requirements.txt
     ```

2. **启动服务**：

   巴什

   ```
   uvicorn app.main:app --reload --port 8000
   ```

   - 启动成功后，桌面服务将运行在：`http://localhost:8000`
   - 您可以访问`http://localhost:8000/docs`查看交互式API文档。

------

### 2.前端服务启动（React + Vite）

前端代码位于`frontend`目录下。请确保您的电脑已安装 Node.js (推荐 v18+)。

1. **进入前端目录**：

   巴什

   ```
   cd frontend
   ```

2. **配置环境变量**： 在`frontend`目录下新建一个名为`.env`的文件，并填入本地本地的地址：

   代码片段

   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

   *(注意：投票不要加斜杠`/`)*

3. **安装依赖**：

   巴什

   ```
   npm install
   ```

4. **启动前端开发服务器**：

   巴什

   ```
   npm run dev
   ```

   - 启动成功后，终端会输出访问地址，通常为：`http://localhost:5173`

------

## 🤖 关于 AI 模块的说明

本系统核心功能依赖于大语言模型（LLM）进行角色扮演与智能评估。

- **本地演示模式**：为防止网络移动或API余额不足影响演示，系统默认集成了Mock模拟对话数据。
- **真实AI接入点**：若需接入点真实大模型，请在前端代码中配置您的`API_KEY`与`BASE_URL`。



## 🌐 线上部署信息（备用，目前还在失败）

- **前端 (Vercel)** :[https://medical-training-demo.vercel.app/](https://www.google.com/search?q=https://medical-training-demo.vercel.app/)
- **渲染（渲染）**：[https://medical-training-demo-backend.onrender.com](https://medical-training-demo-backend.onrender.com/)

