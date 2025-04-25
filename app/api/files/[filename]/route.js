import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// App Router配置
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 此路由用于获取已上传的文件
// 在Vercel环境中，文件实际上已经在内存中，不存储在文件系统中
// 所以这个API可以结合内存缓存或其他存储解决方案使用
export async function GET(request, { params }) {
  try {
    const { filename } = params;
    console.log(`请求获取文件: ${filename}`);
    
    // 检查是否在Vercel环境中
    const isVercel = process.env.VERCEL === '1';
    
    if (isVercel) {
      // Vercel环境，我们没有物理存储文件
      // 这里应该结合一个内存缓存或者外部存储服务
      // 作为示例，我们返回一个错误，建议客户端使用已有的base64数据
      return NextResponse.json({
        success: false,
        message: 'Vercel环境无法直接访问文件系统，请使用上传时返回的base64数据',
        vercelEnvironment: true
      }, { status: 404 });
    } else {
      // 本地开发环境，直接从文件系统读取
      const filePath = join(process.cwd(), 'public', 'uploads', filename);
      
      // 检查文件是否存在
      if (!existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        return NextResponse.json({
          success: false,
          message: '文件不存在'
        }, { status: 404 });
      }
      
      try {
        // 读取文件内容
        const fileContent = await readFile(filePath);
        
        // 识别文件MIME类型
        let contentType = 'application/octet-stream'; // 默认二进制类型
        
        if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (filename.endsWith('.txt')) {
          contentType = 'text/plain';
        } else if (filename.endsWith('.pdf')) {
          contentType = 'application/pdf';
        } else if (filename.endsWith('.doc') || filename.endsWith('.docx')) {
          contentType = 'application/msword';
        }
        
        // 返回文件内容
        return new NextResponse(fileContent, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });
      } catch (error) {
        console.error(`读取文件出错: ${error.message}`);
        return NextResponse.json({
          success: false,
          message: `读取文件出错: ${error.message}`
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error(`处理文件请求出错: ${error.message}`);
    return NextResponse.json({
      success: false,
      message: `处理文件请求出错: ${error.message}`
    }, { status: 500 });
  }
} 