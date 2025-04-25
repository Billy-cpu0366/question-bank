'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllQuestions, getAllCategories, getUncategorizedQuestions, deleteQuestion, deleteCategoryQuestions } from '../models/Question';
import '../globals.css';

export default function BrowsePage() {
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAnswer, setShowAnswer] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, data: null });

  useEffect(() => {
    // 加载题目数据
    setLoading(true);
    
    // 使用setTimeout确保在浏览器环境中运行，并且DOM完全加载后
    setTimeout(() => {
      try {
        const allQuestions = getAllQuestions();
        const allCategories = getAllCategories();
        
        setQuestions(allQuestions);
        setCategories(allCategories);
        
        console.log(`已加载 ${allQuestions.length} 道题目, ${allCategories.length} 个分类`);
      } catch (error) {
        console.error('加载题目数据出错:', error);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  const filteredQuestions = selectedCategory === 'all'
    ? questions
    : questions.filter(q => q.category === selectedCategory);

  const toggleAnswer = (id) => {
    setShowAnswer(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 获取错误等级对应的颜色
  const getErrorLevelColor = (errorCount) => {
    if (errorCount === 0) return 'transparent';
    if (errorCount <= 2) return 'rgba(255, 193, 7, 0.2)';  // 低错误率 - 浅黄色
    if (errorCount <= 5) return 'rgba(255, 152, 0, 0.3)';  // 中错误率 - 浅橙色
    return 'rgba(244, 67, 54, 0.3)';  // 高错误率 - 浅红色
  };

  const handleCategoryDelete = (category) => {
    if (!window.confirm(`确定要删除分类"${category}"下的所有 ${questions.filter(q => q.category === category).length} 道题目吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      const result = deleteCategoryQuestions(category);
      setDeleteStatus(result);
      
      if (result.success) {
        // 更新题目和分类数据
        const updatedQuestions = getAllQuestions();
        const updatedCategories = getAllCategories();
        setQuestions(updatedQuestions);
        setCategories(updatedCategories);
        
        // 如果当前选择的是被删除的分类，重新设置为 'all'
        if (selectedCategory === category) {
          setSelectedCategory('all');
        }
      }
      
      // 3秒后清除状态消息
      setTimeout(() => setDeleteStatus(null), 3000);
    } catch (error) {
      console.error('删除分类失败:', error);
      setDeleteStatus({ success: false, message: `删除分类失败: ${error.message}` });
    }
  };
  
  const handleQuestionDelete = (id) => {
    if (!window.confirm(`确定要删除题目 ${id} 吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      const result = deleteQuestion(id);
      setDeleteStatus(result);
      
      if (result.success) {
        // 更新题目和分类数据
        const updatedQuestions = getAllQuestions();
        const updatedCategories = getAllCategories();
        setQuestions(updatedQuestions);
        setCategories(updatedCategories);
      }
      
      // 3秒后清除状态消息
      setTimeout(() => setDeleteStatus(null), 3000);
    } catch (error) {
      console.error('删除题目失败:', error);
      setDeleteStatus({ success: false, message: `删除题目失败: ${error.message}` });
    }
  };

  // 处理右键菜单的显示
  const handleContextMenu = (e, type, data) => {
    e.preventDefault(); // 阻止默认右键菜单
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  };

  // 点击其他区域关闭右键菜单
  const handleClickOutside = () => {
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
    }
  };

  // 处理右键菜单项的点击
  const handleMenuItemClick = (action) => {
    // 关闭菜单
    setContextMenu({ ...contextMenu, visible: false });
    
    if (action === 'delete') {
      if (contextMenu.type === 'category') {
        handleCategoryDelete(contextMenu.data);
      } else if (contextMenu.type === 'question') {
        handleQuestionDelete(contextMenu.data);
      }
    }
  };

  return (
    <div className="container" onClick={handleClickOutside}>
      <nav className="nav">
        <h1>题库浏览</h1>
        <div>
          <Link href="/" className="nav-link">首页</Link>
          <Link href="/simulate" className="nav-link">模拟训练</Link>
        </div>
      </nav>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div 
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '5px 0',
            zIndex: 1000
          }}
        >
          <div 
            style={{
              padding: '8px 15px',
              cursor: 'pointer',
              color: '#ff5252',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={() => handleMenuItemClick('delete')}
          >
            <span style={{ marginRight: '5px' }}>🗑️</span>
            删除{contextMenu.type === 'category' ? '分类' : '题目'}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <p>正在加载题目数据...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', marginTop: '2rem' }}>
          {/* Category sidebar */}
          <div style={{ width: '200px', marginRight: '1rem' }}>
            <div className="card">
              <h3>分类</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                共 {questions.length} 道题目, {categories.size || 0} 个分类
              </p>
              
              {/* 分类状态信息 */}
              {deleteStatus && (
                <div style={{ 
                  padding: '0.5rem', 
                  backgroundColor: deleteStatus.success ? '#e8f5e9' : '#ffebee',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  {deleteStatus.message}
                </div>
              )}
              
              <div style={{ marginTop: '1rem' }}>
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: selectedCategory === 'all' ? 'var(--primary-color)' : 'transparent',
                    color: selectedCategory === 'all' ? 'white' : 'inherit',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}
                  onClick={() => setSelectedCategory('all')}
                >
                  全部题目 ({questions.length})
                </div>
                
                {[...categories].map(category => (
                  <div
                    key={category}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: selectedCategory === category ? 'var(--primary-color)' : 'transparent',
                      color: selectedCategory === category ? 'white' : 'inherit',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => setSelectedCategory(category)}
                    onContextMenu={(e) => handleContextMenu(e, 'category', category)}
                  >
                    <span>{category}</span>
                    <span>({questions.filter(q => q.category === category).length})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Questions */}
          <div style={{ flex: 1 }}>
            <h2>{selectedCategory === 'all' ? '全部题目' : selectedCategory}</h2>
            
            {filteredQuestions.length === 0 ? (
              <div className="card">
                <p>该分类下暂无题目</p>
              </div>
            ) : (
              filteredQuestions.map(question => (
                <div 
                  key={question.id} 
                  className="card"
                  style={{
                    borderLeft: `4px solid ${getErrorLevelColor(question.errorCount)}`,
                    position: 'relative'
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'question', question.id)}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3>题目 {question.id}</h3>
                    {question.errorCount > 0 && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        padding: '3px 8px',
                        borderRadius: '4px'
                      }}>
                        错误次数: {question.errorCount}
                      </div>
                    )}
                  </div>
                  
                  <p style={{ margin: '1rem 0' }}>{question.content}</p>
                  
                  {/* 选项列表 */}
                  {question.options && question.options.length > 0 && (
                    <div style={{ margin: '1rem 0' }}>
                      {question.options.map((option, index) => (
                        <div key={index} style={{ margin: '0.5rem 0' }}>
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 切换显示答案和解析 */}
                  <div style={{ margin: '1rem 0' }}>
                    <button onClick={() => toggleAnswer(question.id)}>
                      {showAnswer[question.id] ? '隐藏答案' : '显示答案'}
                    </button>
                    
                    {showAnswer[question.id] && (
                      <div style={{ 
                        margin: '1rem 0', 
                        padding: '1rem', 
                        backgroundColor: '#f9f9f9', 
                        borderRadius: '8px' 
                      }}>
                        <p><strong>答案:</strong> {question.answer}</p>
                        <p style={{ marginTop: '0.5rem' }}><strong>解析:</strong> {question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 