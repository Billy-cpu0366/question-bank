'use client';

import { useState } from 'react';
import Link from 'next/link';
import FileUpload from './components/FileUpload';
import './globals.css';

export default function Home() {
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleUploadStatus = (status, message) => {
    setUploadStatus({ status, message });
    
    // Clear status message after 3 seconds
    setTimeout(() => {
      setUploadStatus(null);
    }, 3000);
  };

  return (
    <div className="container">
      <nav className="nav">
        <h1>题库网站</h1>
        <div>
          <Link href="/browse" className="nav-link">浏览题库</Link>
          <Link href="/simulate" className="nav-link">模拟训练</Link>
        </div>
      </nav>
      
      <div className="hero" style={{ textAlign: 'center', margin: '3rem 0' }}>
        <h2>题库管理与学习平台</h2>
        <p style={{ margin: '1rem 0 2rem' }}>上传您的题库文件，管理题目并进行模拟训练</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3>上传题库</h3>
        <FileUpload onUploadStatus={handleUploadStatus} />
        
        {uploadStatus && (
          <div className={uploadStatus.status === 'success' ? 'success-text' : 'error-text'} style={{ marginTop: '1rem' }}>
            {uploadStatus.message}
          </div>
        )}
        
        <div style={{ marginTop: '1rem' }}>
          <h4>支持的文件格式:</h4>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>文本文件 (.txt)</li>
            <li>Excel文件 (.xlsx, .xls)</li>
          </ul>
        </div>
      </div>
      
      <div style={{ margin: '2rem 0', textAlign: 'center' }}>
        <h3>功能特点</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', margin: '1rem 0' }}>
          <div className="card" style={{ flex: '1 1 250px', margin: '0.5rem' }}>
            <h4>自动分类</h4>
            <p>自动识别题库分类并创建对应板块</p>
          </div>
          <div className="card" style={{ flex: '1 1 250px', margin: '0.5rem' }}>
            <h4>题目浏览</h4>
            <p>按分类浏览题目内容和答案解析</p>
          </div>
          <div className="card" style={{ flex: '1 1 250px', margin: '0.5rem' }}>
            <h4>模拟训练</h4>
            <p>随机抽取题目进行做题练习</p>
          </div>
          <div className="card" style={{ flex: '1 1 250px', margin: '0.5rem' }}>
            <h4>错题统计</h4>
            <p>自动记录错题次数和错误频率</p>
          </div>
        </div>
      </div>
    </div>
  );
} 