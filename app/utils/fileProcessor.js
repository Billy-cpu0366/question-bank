import fs from 'fs';
import path from 'path';
import { analyzeQuestion, categorizeQuestion } from './aiAnalysis';
import { addQuestion } from '../models/Question';

/**
 * Processes an uploaded text file to extract questions
 * @param {string} filePath The path to the uploaded file
 * @returns {Promise<{success: boolean, message: string}>} Processing result
 */
export async function processTextFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const questions = parseQuestionsFromText(content);
    
    // Process each question
    for (const question of questions) {
      await processQuestion(question);
    }
    
    return {
      success: true,
      message: `成功处理 ${questions.length} 道题目`
    };
  } catch (error) {
    console.error('File processing error:', error);
    return {
      success: false,
      message: '文件处理失败: ' + error.message
    };
  }
}

/**
 * Parses questions from text content
 * @param {string} content The content of a text file
 * @returns {Array<{content: string, options: Array<string>, answer: string, explanation: string}>} Parsed questions
 */
function parseQuestionsFromText(content) {
  // Split the content by lines
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  const questions = [];
  let currentQuestion = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a new question (simple detection logic)
    if (/^\d+\./.test(line) || /^问题\s*\d+/.test(line)) {
      // Save the previous question if it exists
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      
      // Start a new question
      currentQuestion = {
        content: line.replace(/^\d+\.|\s*问题\s*\d+:?\s*/, '').trim(),
        options: [],
        answer: '',
        explanation: ''
      };
    } 
    // Check if this line is an option
    else if (currentQuestion && /^[A-D]\./.test(line)) {
      currentQuestion.options.push(line.trim());
    }
    // Check if this line is an answer
    else if (currentQuestion && /^答案[:：]/.test(line)) {
      currentQuestion.answer = line.replace(/^答案[:：]\s*/, '').trim();
    }
    // Check if this line is an explanation
    else if (currentQuestion && /^解析[:：]/.test(line)) {
      // Start collecting explanation lines
      let explanation = line.replace(/^解析[:：]\s*/, '').trim();
      
      // Keep reading lines as long as they don't start a new question/option/answer
      while (i + 1 < lines.length && 
             !/^\d+\./.test(lines[i + 1]) && 
             !/^问题\s*\d+/.test(lines[i + 1]) && 
             !/^[A-D]\./.test(lines[i + 1]) && 
             !/^答案[:：]/.test(lines[i + 1]) && 
             !/^解析[:：]/.test(lines[i + 1])) {
        explanation += ' ' + lines[i + 1].trim();
        i++;
      }
      
      currentQuestion.explanation = explanation;
    }
    // If it's part of the current question content
    else if (currentQuestion) {
      // If we haven't assigned any options or answers yet, assume it's still part of the question
      if (currentQuestion.options.length === 0 && !currentQuestion.answer) {
        currentQuestion.content += ' ' + line;
      }
    }
  }
  
  // Add the last question if it exists
  if (currentQuestion) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

/**
 * Processes a single question
 * @param {Object} question The question object
 * @returns {Promise<void>}
 */
async function processQuestion(question) {
  try {
    // If the question doesn't have an answer, use AI to generate one
    if (!question.answer) {
      const aiResult = await analyzeQuestion(question.content);
      question.answer = aiResult.answer;
      question.explanation = aiResult.explanation;
    }
    
    // If the question doesn't have a category, use AI to generate one
    let category = '未分类';
    try {
      category = await categorizeQuestion(question.content);
    } catch (error) {
      console.error('Error categorizing question:', error);
    }
    
    // Add the question to the database
    addQuestion(
      question.content,
      question.options,
      question.answer,
      question.explanation,
      category
    );
  } catch (error) {
    console.error('Error processing question:', error);
    throw error;
  }
} 