import axios from 'axios';

/**
 * Analyzes a question using AI to generate an answer and explanation
 * @param {string} question The question text to analyze
 * @returns {Promise<{answer: string, explanation: string}>} The AI-generated answer and explanation
 */
export async function analyzeQuestion(question) {
  try {
    // Use a more reliable API endpoint - Changed from the original URL which returns 404
    // Try different models and endpoints based on availability
    const apiEndpoints = [
      {
        url: 'https://api.ark-ai.cn/v3/chat/completions',
        key: 'ec0924a2-cfb5-466f-8619-32b801a009af',
        model: 'qwen2-7b-instruct'
      },
      { 
        url: 'https://api.volcengine.com/ai/inference/v1/chat/completions',
        key: 'ec0924a2-cfb5-466f-8619-32b801a009af',
        model: 'skylark-chat'
      }
    ];
    
    // Try each endpoint in sequence until one succeeds
    let lastError = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`Trying AI analysis with endpoint: ${endpoint.url}`);
        
        const response = await axios.post(
          endpoint.url,
          {
            model: endpoint.model,
            messages: [
              {
                role: 'system',
                content: '你是一个专业的教育助手，擅长解答各类学科问题并提供详细的解析。给出答案时，先提供简短的答案，然后提供详细的解析。'
              },
              {
                role: 'user',
                content: question
              }
            ],
            temperature: 0.7,
            max_tokens: 800
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${endpoint.key}`
            },
            timeout: 30000 // 30 second timeout
          }
        );
        
        // Check if response is valid
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
          
          // Extract the answer and explanation from the AI response
          const aiResponse = response.data.choices[0].message.content;
          
          // Parse the response to extract answer and explanation
          const lines = aiResponse.split('\n');
          let answer = '';
          let explanation = '';
          
          if (lines.length > 0) {
            // Assume first line contains the answer
            answer = lines[0].replace(/^答案[:：]\s*/, '');
            
            // Rest is the explanation
            explanation = lines.slice(1).join('\n').trim();
          }
          
          console.log('AI analysis successful');
          return {
            answer,
            explanation: explanation || '暂无解析'
          };
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint.url}:`, error.message);
        lastError = error;
        // Continue to the next endpoint
      }
    }
    
    // If we've exhausted all endpoints, use a fallback local method
    console.warn('All AI endpoints failed, using fallback analysis method');
    
    // Simple pattern matching to provide a basic answer
    // This is a very simplified approach for when API calls fail
    const keywordPatterns = [
      { pattern: /线性表|数组|链表|队列|栈/, answer: '数据结构相关' },
      { pattern: /时间复杂度|空间复杂度|[O|o]\([n|N]/, answer: '算法复杂度相关' },
      { pattern: /二分|排序|搜索|查找/, answer: '算法相关' },
      { pattern: /程序|编程|代码|函数|变量/, answer: '编程基础相关' }
    ];
    
    for (const { pattern, answer } of keywordPatterns) {
      if (pattern.test(question)) {
        return {
          answer: '无法获取精确答案',
          explanation: `由于AI服务暂时不可用，无法提供详细解析。根据简单分析，这可能是${answer}的问题。请稍后再试。`
        };
      }
    }
    
    throw lastError || new Error('所有AI接口调用失败');
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      answer: '分析失败',
      explanation: `无法获取AI解析，请稍后重试。错误信息: ${error.message}`
    };
  }
}

/**
 * Categorizes a question using AI
 * @param {string} question The question text to categorize
 * @returns {Promise<string>} The AI-determined category
 */
export async function categorizeQuestion(question) {
  try {
    // 首先尝试从题目内容中检测知识点标记
    const knowledgePointMatch = question.match(/知识点[:：]\s*([^。\n]+)/);
    if (knowledgePointMatch && knowledgePointMatch[1]) {
      const knowledgePoint = knowledgePointMatch[1].trim();
      console.log(`从题目内容中提取到知识点: ${knowledgePoint}`);
      
      // 提取知识点中的核心分类部分
      // 例如："线性表" -> "线性表", "数据结构-线性表" -> "线性表"
      // 或 "哈希表和二叉树" -> "数据结构"
      const categoryKeywords = {
        '线性表': '线性表',
        '队列': '队列',
        '栈': '栈',
        '链表': '链表',
        '二叉树': '树结构',
        '树': '树结构',
        '图': '图结构',
        '排序': '排序算法',
        '查找': '查找算法',
        '哈希': '哈希结构',
        '散列': '哈希结构',
        '算法': '算法',
        '复杂度': '算法复杂度',
        '数据结构': '数据结构',
        '数据库': '数据库',
        '关系代数': '关系代数',
        'SQL': '数据库语言',
        '存储': '数据存储',
        '索引': '数据库索引',
        '事务': '数据库事务',
        '编程': '编程基础',
        '函数': '函数与方法',
        '递归': '递归算法',
        '指针': '指针与内存',
        '内存': '指针与内存',
        '变量': '变量与数据类型',
        '程序': '程序设计'
      };
      
      // 查找匹配的关键词
      for (const [keyword, category] of Object.entries(categoryKeywords)) {
        if (knowledgePoint.includes(keyword)) {
          console.log(`根据知识点 "${knowledgePoint}" 匹配到分类: "${category}"`);
          return category;
        }
      }
      
      // 如果没有匹配到特定关键词但有知识点，直接使用知识点作为分类
      if (knowledgePoint.length > 0) {
        return knowledgePoint;
      }
    }
    
    // Use the same alternative endpoints as in analyzeQuestion
    const apiEndpoints = [
      {
        url: 'https://api.ark-ai.cn/v3/chat/completions',
        key: 'ec0924a2-cfb5-466f-8619-32b801a009af',
        model: 'qwen2-7b-instruct'
      },
      { 
        url: 'https://api.volcengine.com/ai/inference/v1/chat/completions',
        key: 'ec0924a2-cfb5-466f-8619-32b801a009af',
        model: 'skylark-chat'
      }
    ];
    
    // Try each endpoint in sequence until one succeeds
    let lastError = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`Trying category analysis with endpoint: ${endpoint.url}`);
        
        const response = await axios.post(
          endpoint.url,
          {
            model: endpoint.model,
            messages: [
              {
                role: 'system',
                content: '你是一个专业的计算机科学题目分类助手。请分析以下问题，并只回复一个简短的分类名称，使用常见的计算机科学课程分类，如："数据结构"、"算法"、"数据库"、"编程语言"、"计算机网络"、"操作系统"、"软件工程"等。'
              },
              {
                role: 'user',
                content: `请分类以下问题: ${question}`
              }
            ],
            temperature: 0.3,
            max_tokens: 50
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${endpoint.key}`
            },
            timeout: 15000 // 15 second timeout
          }
        );
        
        // Check if response is valid
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            
          // Extract the category from the AI response
          const category = response.data.choices[0].message.content.trim();
          console.log(`AI分类结果: "${category}"`);
          
          return category;
        }
      } catch (error) {
        console.error(`Error with category endpoint ${endpoint.url}:`, error.message);
        lastError = error;
        // Continue to the next endpoint
      }
    }
    
    // If all API endpoints failed, use a simple keyword-based classification
    console.warn('All API endpoints failed for categorization, using fallback');
    
    // Basic keyword matching for categories
    const keywordCategories = [
      { keywords: ['数组', '线性表', '链表', '栈', '队列'], category: '数据结构' },
      { keywords: ['排序', '查找', '算法', '复杂度', 'O(n)'], category: '算法' },
      { keywords: ['二叉树', '平衡树', 'B树', '红黑树'], category: '树结构' },
      { keywords: ['图', '邻接', '路径', '遍历'], category: '图结构' },
      { keywords: ['函数', '递归', '变量', '语句'], category: '编程基础' },
      { keywords: ['数据库', 'SQL', '表', '查询'], category: '数据库' }
    ];
    
    for (const { keywords, category } of keywordCategories) {
      if (keywords.some(keyword => question.includes(keyword))) {
        return category;
      }
    }
    
    return '未分类';
  } catch (error) {
    console.error('Category analysis error:', error);
    return '未分类';
  }
} 