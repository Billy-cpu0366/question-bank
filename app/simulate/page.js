'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllQuestions, incrementErrorCount } from '../models/Question';
import '../globals.css';

export default function SimulatePage() {
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState({});
  const [numQuestions, setNumQuestions] = useState(10);
  
  useEffect(() => {
    // 加载所有题目
    setAllQuestions(getAllQuestions());
  }, []);
  
  const handleStartSimulation = () => {
    // 随机选择题目
    const questionPool = [...allQuestions];
    const selectedQuestions = [];
    
    // 使用可用题目数量和请求的数量中的较小值
    const count = Math.min(numQuestions, questionPool.length);
    
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * questionPool.length);
      selectedQuestions.push(questionPool[randomIndex]);
      questionPool.splice(randomIndex, 1);
    }
    
    setQuestions(selectedQuestions);
    setCurrentAnswers({});
    setSubmitted(false);
    setResults({});
  };
  
  const handleAnswerChange = (questionId, answer) => {
    setCurrentAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };
  
  const handleSubmit = () => {
    const newResults = {};
    let correctCount = 0;
    
    // 检查答案并更新结果
    questions.forEach(question => {
      const userAnswer = currentAnswers[question.id] || '';
      const isCorrect = userAnswer === question.answer;
      
      if (!isCorrect) {
        // 更新错题计数
        incrementErrorCount(question.id);
      } else {
        correctCount++;
      }
      
      newResults[question.id] = {
        userAnswer,
        correctAnswer: question.answer,
        isCorrect
      };
    });
    
    setResults(newResults);
    setSubmitted(true);
  };
  
  return (
    <div className="container">
      <nav className="nav">
        <h1>模拟训练</h1>
        <div>
          <Link href="/" className="nav-link">首页</Link>
          <Link href="/browse" className="nav-link">浏览题库</Link>
        </div>
      </nav>
      
      {questions.length === 0 ? (
        <div className="card" style={{ maxWidth: '500px', margin: '2rem auto' }}>
          <h2>开始模拟训练</h2>
          <p style={{ margin: '1rem 0' }}>选择题目数量并开始训练</p>
          
          <div style={{ margin: '1rem 0' }}>
            <label htmlFor="numQuestions">题目数量:</label>
            <input 
              type="number" 
              id="numQuestions" 
              min="1" 
              max={allQuestions.length} 
              value={numQuestions}
              onChange={e => setNumQuestions(parseInt(e.target.value) || 10)}
            />
          </div>
          
          <button onClick={handleStartSimulation}>开始训练</button>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          {submitted ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>训练结果</h2>
                <div>
                  <span style={{ marginRight: '1rem' }}>
                    正确率: {Math.round((Object.values(results).filter(r => r.isCorrect).length / questions.length) * 100)}%
                  </span>
                  <button onClick={() => {
                    setQuestions([]);
                    setCurrentAnswers({});
                    setSubmitted(false);
                    setResults({});
                  }}>重新开始</button>
                </div>
              </div>
              
              {/* 显示结果 */}
              {questions.map(question => {
                const result = results[question.id];
                return (
                  <div key={question.id} className="card" style={{
                    borderLeft: result?.isCorrect ? '4px solid var(--secondary-color)' : '4px solid var(--error-color)'
                  }}>
                    <h3>问题 {question.id}</h3>
                    <p style={{ margin: '1rem 0' }}>{question.content}</p>
                    
                    {question.options.length > 0 && (
                      <div style={{ 
                        margin: '1.5rem auto', 
                        maxWidth: '650px',
                        backgroundColor: '#f9f9f9',
                        padding: '1.5rem',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          gap: '15px'
                        }}>
                          {question.options.map((option, index) => {
                            const isCorrect = option.startsWith(question.answer);
                            // 拆分选项文本，分离字母和内容
                            const optionLetter = option.charAt(0);
                            const optionText = option.substring(2).trim(); 
                            
                            return (
                              <div key={index} style={{ 
                                width: 'calc(50% - 15px)',
                                minHeight: '60px',
                                padding: '0.8rem',
                                borderRadius: '8px',
                                backgroundColor: isCorrect ? 'rgba(76, 175, 80, 0.1)' : 'white',
                                border: '1px solid #eaeaea',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                <div style={{ 
                                  fontWeight: 'bold',
                                  color: isCorrect ? 'var(--secondary-color)' : 'inherit',
                                  marginRight: '8px' 
                                }}>
                                  {optionLetter}.
                                </div>
                                <div style={{ 
                                  flex: 1, 
                                  textAlign: 'left',
                                  color: isCorrect ? 'var(--secondary-color)' : 'inherit',
                                  fontWeight: isCorrect ? 'bold' : 'normal'
                                }}>
                                  {optionText}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ margin: '1rem auto', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', maxWidth: '600px' }}>
                      <p><strong>您的答案:</strong> {result?.userAnswer || '未回答'}</p>
                      <p><strong>正确答案:</strong> {question.answer}</p>
                      <p style={{ marginTop: '0.5rem' }}><strong>解析:</strong> {question.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>回答以下问题</h2>
                <button onClick={handleSubmit}>提交答案</button>
              </div>
              
              {/* 显示问题 */}
              {questions.map(question => (
                <div key={question.id} className="card">
                  <h3>问题 {question.id}</h3>
                  <p style={{ margin: '1rem 0' }}>{question.content}</p>
                  
                  {question.options.length > 0 ? (
                    <div style={{ 
                      margin: '1.5rem auto', 
                      maxWidth: '650px', 
                      backgroundColor: '#f9f9f9',
                      padding: '1.5rem',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '15px'
                      }}>
                        {question.options.map((option, index) => {
                          const optionLetter = option.charAt(0); 
                          const optionText = option.substring(2).trim();
                          
                          return (
                            <div key={index} style={{ 
                              width: 'calc(50% - 15px)',
                              minHeight: '60px',
                              padding: '0.8rem',
                              borderRadius: '8px',
                              backgroundColor: currentAnswers[question.id] === optionLetter ? '#e3f2fd' : 'white',
                              border: '1px solid #eaeaea',
                              transition: 'background-color 0.2s, transform 0.1s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                              cursor: 'pointer',
                              transform: currentAnswers[question.id] === optionLetter ? 'scale(1.02)' : 'scale(1)',
                              display: 'flex',
                              alignItems: 'center'
                            }} onClick={() => handleAnswerChange(question.id, optionLetter)}>
                              <div style={{ fontWeight: 'bold', marginRight: '8px' }}>
                                {optionLetter}.
                              </div>
                              <div>
                                {optionText}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ margin: '1rem 0' }}>
                      <label htmlFor={`answer-${question.id}`}>你的答案:</label>
                      <input
                        id={`answer-${question.id}`}
                        type="text"
                        value={currentAnswers[question.id] || ''}
                        onChange={e => handleAnswerChange(question.id, e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
} 