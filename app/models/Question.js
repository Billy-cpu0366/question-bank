// In a real application, this would be connected to a database
// For demo purposes, we'll simulate a database with an in-memory store

class Question {
  constructor(id, content, options = [], answer, explanation, category, errorCount = 0) {
    this.id = id;
    this.content = content;
    this.options = options; // For multiple choice questions
    this.answer = answer;
    this.explanation = explanation;
    this.category = category;
    this.errorCount = errorCount;
  }

  // Get error level (low, medium, high) based on error count
  getErrorLevel() {
    if (this.errorCount === 0) return 'none';
    if (this.errorCount <= 2) return 'low';
    if (this.errorCount <= 5) return 'medium';
    return 'high';
  }
}

// Simulated in-memory database
let questions = [];
let categories = new Set();
let nextId = 1;

// 加载本地存储的题目数据
const loadQuestionsFromStorage = () => {
  try {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('questionData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        questions = parsedData.questions.map(q => new Question(
          q.id, q.content, q.options, q.answer, q.explanation, q.category, q.errorCount
        ));
        
        categories = new Set(parsedData.categories);
        nextId = parsedData.nextId;
        
        console.log(`从本地存储加载了 ${questions.length} 道题目, ${categories.size} 个分类`);
      }
    }
  } catch (error) {
    console.error('加载题目数据失败:', error);
  }
};

// 保存题目数据到本地存储
const saveQuestionsToStorage = () => {
  try {
    if (typeof window !== 'undefined') {
      const data = {
        questions,
        categories: Array.from(categories),
        nextId
      };
      
      localStorage.setItem('questionData', JSON.stringify(data));
      console.log(`保存了 ${questions.length} 道题目到本地存储`);
    }
  } catch (error) {
    console.error('保存题目数据失败:', error);
  }
};

// Add a new question to the database
export const addQuestion = (content, options = [], answer, explanation, category) => {
  const id = nextId++;
  const question = new Question(id, content, options, answer, explanation, category);
  questions.push(question);
  categories.add(category);
  
  // 保存到本地存储
  saveQuestionsToStorage();
  
  return question;
};

// Get all questions
export const getAllQuestions = () => {
  return [...questions];
};

// Get questions by category
export const getQuestionsByCategory = (category) => {
  return questions.filter(q => q.category === category);
};

// Get all categories
export const getAllCategories = () => {
  return [...categories];
};

// Get question by ID
export const getQuestionById = (id) => {
  return questions.find(q => q.id === parseInt(id));
};

// Update error count for a question
export const incrementErrorCount = (id) => {
  const question = getQuestionById(id);
  if (question) {
    question.errorCount++;
    // 保存变更
    saveQuestionsToStorage();
    return question;
  }
  return null;
};

// 更新题目的分类
export const updateQuestionCategory = (id, category) => {
  const question = getQuestionById(id);
  if (question) {
    question.category = category;
    categories.add(category);
    // 保存变更
    saveQuestionsToStorage();
    return question;
  }
  return null;
};

// 获取所有未分类的题目
export const getUncategorizedQuestions = () => {
  return questions.filter(q => !q.category || q.category === '未分类');
};

// 批量更新未分类题目
export const batchCategorizeQuestions = async (callback) => {
  const uncategorizedQuestions = getUncategorizedQuestions();
  if (uncategorizedQuestions.length === 0) {
    return { success: true, message: '没有未分类的题目' };
  }
  
  console.log(`开始批量分类 ${uncategorizedQuestions.length} 道未分类题目...`);
  let processedCount = 0;
  let successCount = 0;
  
  try {
    // 依次处理每个未分类题目
    for (const question of uncategorizedQuestions) {
      processedCount++;
      try {
        // 获取题目分类（通过回调函数，实际会调用categorizeQuestion）
        const category = await callback(question.content);
        if (category && category !== '未分类') {
          // 更新题目分类
          updateQuestionCategory(question.id, category);
          successCount++;
          console.log(`已分类题目 ${question.id}: "${category}"`);
        }
      } catch (error) {
        console.error(`分类题目 ${question.id} 失败:`, error);
      }
      
      // 每处理5个题目，暂停1秒，避免API请求过于频繁
      if (processedCount % 5 === 0) {
        console.log(`已处理 ${processedCount}/${uncategorizedQuestions.length} 道题目，暂停1秒...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 保存所有更改
    saveQuestionsToStorage();
    
    return { 
      success: true, 
      message: `成功分类 ${successCount}/${uncategorizedQuestions.length} 道题目` 
    };
  } catch (error) {
    console.error('批量分类题目失败:', error);
    return { 
      success: false, 
      message: `分类过程中出错: ${error.message}` 
    };
  }
};

// 删除单个题目
export const deleteQuestion = (id) => {
  const questionIndex = questions.findIndex(q => q.id === parseInt(id));
  if (questionIndex === -1) {
    return { success: false, message: '题目不存在' };
  }
  
  // 删除题目
  const deletedQuestion = questions.splice(questionIndex, 1)[0];
  console.log(`已删除题目 ${deletedQuestion.id}: ${deletedQuestion.content.substring(0, 30)}...`);
  
  // 更新后续题目的ID
  reorderQuestionIds(deletedQuestion.id);
  
  // 更新分类列表（如果某个分类已经没有题目，从分类列表中移除）
  updateCategories();
  
  // 保存变更
  saveQuestionsToStorage();
  
  return { success: true, message: `已删除题目 ${id} 并更新后续题号` };
};

// 删除整个分类的题目
export const deleteCategoryQuestions = (category) => {
  if (!categories.has(category)) {
    return { success: false, message: '分类不存在' };
  }
  
  // 找到该分类下的所有题目
  const categoryQuestions = questions.filter(q => q.category === category);
  if (categoryQuestions.length === 0) {
    return { success: false, message: '该分类下没有题目' };
  }
  
  // 保存原始题目数量和被删除题目的ID列表，以便后续重新排序
  const originalCount = questions.length;
  const deletedIds = categoryQuestions.map(q => q.id).sort((a, b) => a - b);
  
  // 移除该分类下的所有题目
  questions = questions.filter(q => q.category !== category);
  
  // 计算删除的题目数量
  const deletedCount = originalCount - questions.length;
  console.log(`已删除分类 "${category}" 下的 ${deletedCount} 道题目`);
  
  // 更新后续题目的ID，从最小被删除ID开始重排
  if (deletedIds.length > 0) {
    reorderQuestionIds(deletedIds[0]);
  }
  
  // 从分类列表中移除该分类
  categories.delete(category);
  
  // 保存变更
  saveQuestionsToStorage();
  
  return { 
    success: true, 
    message: `已删除分类 "${category}" 下的 ${deletedCount} 道题目并更新题号` 
  };
};

// 重新排序题目ID
const reorderQuestionIds = (startId) => {
  // 找出所有ID大于等于startId的题目
  const questionsToUpdate = questions.filter(q => q.id > startId);
  
  if (questionsToUpdate.length === 0) {
    console.log('没有需要更新ID的题目');
    return;
  }
  
  console.log(`开始更新 ${questionsToUpdate.length} 道题目的ID，从ID ${startId} 开始`);
  
  // 首先按ID排序
  questionsToUpdate.sort((a, b) => a.id - b.id);
  
  // 创建ID映射表，记录原ID到新ID的映射
  const idMap = new Map();
  
  // 为每个题目分配新ID
  let newId = startId;
  questionsToUpdate.forEach(question => {
    const oldId = question.id;
    idMap.set(oldId, newId);
    question.id = newId;
    newId++;
  });
  
  console.log(`题目ID更新完成，更新了 ${questionsToUpdate.length} 道题目的ID`);
  
  // 由于ID发生变化，更新nextId
  if (questions.length > 0) {
    const maxId = Math.max(...questions.map(q => q.id));
    nextId = maxId + 1;
    console.log(`更新nextId为 ${nextId}`);
  }
  
  return idMap;
};

// 更新题目解析
export const updateQuestionExplanation = (id, explanation) => {
  const question = getQuestionById(id);
  if (!question) {
    return { success: false, message: '题目不存在' };
  }
  
  // 更新解析内容
  question.explanation = explanation;
  console.log(`已更新题目 ${id} 的解析`);
  
  // 保存变更
  saveQuestionsToStorage();
  
  return { success: true, message: '解析已更新' };
};

// 更新分类列表
const updateCategories = () => {
  // 清空当前分类列表
  categories = new Set();
  
  // 重新从题目中提取所有分类
  questions.forEach(question => {
    if (question.category) {
      categories.add(question.category);
    }
  });
  
  console.log(`更新分类列表，现有 ${categories.size} 个分类`);
};

// Add a mock question for testing
export const addMockQuestions = () => {
  addQuestion(
    '以下哪种数据结构适合用于实现先进先出的队列？',
    ['A. 栈', 'B. 链表', 'C. 二叉树', 'D. 图'],
    'B',
    '链表是一种线性数据结构，可以很方便地实现先进先出的队列。在链表中，我们可以在一端添加元素，在另一端删除元素，从而实现队列的FIFO特性。',
    '数据结构'
  );

  addQuestion(
    '关系数据库中的主键的作用是什么？',
    ['A. 加速查询', 'B. 唯一标识记录', 'C. 建立外键关系', 'D. 所有以上'],
    'D',
    '主键在关系数据库中有多重作用：它能唯一标识表中的记录，加速对表的查询操作，并且可以作为其他表的外键来建立表之间的关系。',
    '数据库'
  );

  addQuestion(
    'Python中，列表和元组的主要区别是什么？',
    ['A. 列表可变，元组不可变', 'B. 列表用方括号，元组用圆括号', 'C. 列表可以包含任何数据类型，元组不能', 'D. A和B'],
    'D',
    'Python中，列表是可变的（mutable），而元组是不可变的（immutable）。从语法上，列表使用方括号 [] 定义，而元组使用圆括号 () 定义。两者都可以包含任何数据类型。',
    '编程语言'
  );
};

// 在客户端加载时初始化数据
if (typeof window !== 'undefined') {
  // 确保只在浏览器环境中运行
  loadQuestionsFromStorage();
  
  // 如果没有题目数据，加载一些示例题目
  if (questions.length === 0) {
    console.log('没有发现题目数据，添加默认示例题目');
    addMockQuestions();
  }
}

export default Question; 