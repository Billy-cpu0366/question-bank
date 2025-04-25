'use client';

import { useState } from 'react';
import axios from 'axios';
import { processExcelFile, processExcelRowsFromMemory } from '../utils/excelProcessor';
import * as XLSX from 'xlsx';

export default function FileUpload({ onUploadStatus }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // 直接处理Excel文件的base64内容
  const processExcelBase64 = async (base64Content, fileName) => {
    try {
      console.log('处理Excel文件的base64内容...');
      
      // 将base64转换为二进制数据
      const binaryString = window.atob(base64Content);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 解析Excel数据
      const workbook = XLSX.read(bytes, {type: 'array'});
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 将工作表转换为JSON对象数组
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      console.log(`从base64内容中读取到 ${rows.length} 行数据`);
      
      // 调用处理函数直接处理内存中的数据
      return await processExcelRowsFromMemory(rows);
      
    } catch (error) {
      console.error('处理Excel base64内容错误:', error);
      return {
        success: false,
        message: '处理Excel文件失败: ' + error.message
      };
    }
  };

  const processUploadedFile = async (fileUrl, fileType, fileContent = null, isVercel = false) => {
    try {
      setIsProcessing(true);
      onUploadStatus('success', '文件上传成功，正在处理题库...');
      
      // 根据文件类型处理
      let result;
      
      // 判断是否在Vercel环境中，且有base64编码的文件内容
      if (isVercel && fileContent) {
        console.log('Vercel环境: 使用base64内容处理文件');
        if (fileType === 'xlsx' || fileType === 'xls') {
          result = await processExcelBase64(fileContent, fileUrl.split('/').pop());
        } else {
          result = {
            success: false,
            message: `暂不支持在Vercel环境中处理 .${fileType} 文件格式，敬请期待`
          };
        }
      } else {
        // 原有的处理逻辑 - 使用URL获取文件
        if (fileType === 'xlsx' || fileType === 'xls') {
          console.log('处理Excel文件...');
          result = await processExcelFile(fileUrl);
        } else {
          result = {
            success: false,
            message: `暂不支持 .${fileType} 文件格式处理，敬请期待`
          };
        }
      }
      
      // 显示处理结果
      if (result.success) {
        onUploadStatus('success', result.message);
      } else {
        onUploadStatus('error', result.message);
      }
    } catch (error) {
      console.error('处理文件错误:', error);
      onUploadStatus('error', '处理文件时出错: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      onUploadStatus('error', '请选择一个文件上传');
      return;
    }

    const allowedTypes = [
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      onUploadStatus('error', '不支持的文件格式。请上传 txt, xlsx, xls, pdf, docx 或 doc 文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // 获取文件信息
        const fileUrl = response.data.fileUrl;
        const fileType = file.name.split('.').pop().toLowerCase();
        const fileContent = response.data.fileContent; // base64编码的文件内容
        const isVercel = response.data.isVercel; // 是否在Vercel环境中
        
        // 处理上传的文件
        await processUploadedFile(fileUrl, fileType, fileContent, isVercel);
        
        // 重置文件输入
        setFile(null);
        document.getElementById('file-upload').value = '';
      } else {
        onUploadStatus('error', response.data.message || '上传失败，请重试');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadStatus('error', '上传过程中发生错误，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="file-upload" style={{ display: 'block', marginBottom: '0.5rem' }}>
          选择题库文件:
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          accept=".txt,.xlsx,.xls,.pdf,.docx,.doc"
        />
      </div>
      
      <button 
        type="submit" 
        disabled={isUploading || isProcessing}
        style={{ width: '100%' }}
      >
        {isUploading ? '上传中...' : isProcessing ? '处理中...' : '上传题库'}
      </button>
    </form>
  );
} 