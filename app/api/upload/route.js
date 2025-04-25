import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { processTextFile } from '../../utils/fileProcessor';
import { processExcelFile } from '../../utils/excelProcessor';

// App Router中的路由配置
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // 默认是edge，但文件系统操作需要nodejs
export const maxDuration = 60; // 秒 - Vercel Hobby计划最大允许60秒

export async function POST(request) {
  try {
    console.log('开始处理文件上传请求');
    // Get the FormData from the request
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      console.error('没有找到文件');
      return NextResponse.json({ success: false, message: '没有找到文件' }, { status: 400 });
    }

    console.log(`接收到文件: ${file.name}, 大小: ${file.size} 字节`);

    // 检查是否在Vercel环境中
    const isVercel = process.env.VERCEL === '1';
    console.log(`是否在Vercel环境: ${isVercel}`);

    // 读取文件内容到内存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let fileName, fileUrl;
    
    // Vercel环境中，我们直接在内存中处理文件，不写入磁盘
    if (isVercel) {
      // 创建一个临时文件名，但不实际写入磁盘
      const timestamp = Date.now();
      fileName = `${timestamp}-${file.name}`;
      fileUrl = `/api/files/${fileName}`; // 这个URL将来可以用于API路由获取文件
      
      // 直接处理文件内容
      console.log('Vercel环境：直接处理文件内容，不写入磁盘');
      
      // 在这里可以进行直接处理，例如解析Excel内容
      // 略过实际的文件写入步骤
    } else {
      // 本地开发环境：创建uploads目录并写入文件
      const uploadsDir = join(process.cwd(), 'public', 'uploads');
      
      // 确保uploads目录存在
      try {
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }
        console.log(`确保上传目录存在: ${uploadsDir}`);
      } catch (error) {
        console.error('创建上传目录出错:', error);
        return NextResponse.json({ 
          success: false, 
          message: '无法创建上传目录: ' + error.message 
        }, { status: 500 });
      }

      // 创建唯一文件名并写入
      const timestamp = Date.now();
      fileName = `${timestamp}-${file.name}`;
      const filePath = join(uploadsDir, fileName);
      console.log(`将文件保存到: ${filePath}`);

      try {
        await writeFile(filePath, buffer);
        console.log('文件已写入到磁盘');

        // 验证文件已成功写入
        if (!existsSync(filePath)) {
          console.error(`文件写入失败，无法在路径 ${filePath} 找到文件`);
          return NextResponse.json({ 
            success: false, 
            message: '文件保存失败，无法写入文件' 
          }, { status: 500 });
        }
        
        fileUrl = `/uploads/${fileName}`;
      } catch (error) {
        console.error('文件写入失败:', error);
        return NextResponse.json({ 
          success: false, 
          message: '文件写入失败: ' + error.message 
        }, { status: 500 });
      }
    }

    // 获取文件类型
    const fileType = file.name.split('.').pop().toLowerCase();
    console.log(`文件类型: ${fileType}`);
    
    // 返回成功响应，包含文件信息
    return NextResponse.json({ 
      success: true,
      fileName,
      fileUrl,
      message: '文件上传成功，正在处理中...',
      isVercel: isVercel,
      // 对于Vercel环境，也可以传递文件内容的base64编码
      fileContent: isVercel ? buffer.toString('base64') : null
    });

  } catch (error) {
    console.error('文件上传处理错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '文件上传失败: ' + error.message 
    }, { status: 500 });
  }
} 