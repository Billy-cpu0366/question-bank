import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
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

    // Create uploads directory in public folder so files can be accessed via URL
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
      console.log(`确保上传目录存在: ${uploadsDir}`);
    } catch (error) {
      // Directory already exists or cannot be created
      console.error('创建上传目录出错:', error);
    }

    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = join(uploadsDir, fileName);
    console.log(`将文件保存到: ${filePath}`);

    // Convert file to buffer and write to filesystem
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
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

    // 不使用URL直接处理文件，改为直接从文件流处理
    // 将文件从上传后的位置直接处理
    let result;
    const fileType = file.name.split('.').pop().toLowerCase();
    console.log(`文件类型: ${fileType}`);
    
    // 这里我们直接处理已上传的文件，不通过URL
    // 先返回成功上传的响应
    return NextResponse.json({ 
      success: true,
      fileName,
      fileUrl: `/uploads/${fileName}`,
      message: '文件上传成功，正在处理中...'
    });

  } catch (error) {
    console.error('文件上传处理错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '文件上传失败: ' + error.message 
    }, { status: 500 });
  }
} 