import { analyzeQuestion, categorizeQuestion } from './aiAnalysis';
import { addQuestion } from '../models/Question';
import * as XLSX from 'xlsx';

/**
 * 处理从内存中解析的Excel数据(用于Vercel环境)
 * @param {Array<Array>} rows 解析后的Excel行数据
 * @returns {Promise<{success: boolean, message: string}>} 处理结果
 */
export async function processExcelRowsFromMemory(rows) {
  try {
    console.log(`处理从内存中解析的Excel数据，共 ${rows.length} 行`);
    
    if (rows.length <= 1) {
      return {
        success: false,
        message: 'Excel数据为空或只包含标题行'
      };
    }
    
    // 检测表格结构并提取题目
    const questions = parseQuestionsFromExcel(rows);
    console.log(`从表格中提取出 ${questions.length} 个问题`);
    
    if (questions.length === 0) {
      return {
        success: false,
        message: '无法从Excel数据中解析出题目，请确保格式正确'
      };
    }
    
    // 设置处理的最大题目数量，防止处理太多题目导致超时
    const MAX_QUESTIONS = 100; // 增加到100题
    const questionsToProcess = questions.slice(0, MAX_QUESTIONS);
    console.log(`将处理 ${questionsToProcess.length} 道题目（从 ${questions.length} 道中）`);
    
    // 处理每个问题
    for (const question of questionsToProcess) {
      await processQuestion(question);
    }
    
    let message = `成功处理 ${questionsToProcess.length} 道题目`;
    if (questions.length > MAX_QUESTIONS) {
      message += `（共发现 ${questions.length} 道题目，限制处理数量为 ${MAX_QUESTIONS}）`;
    }
    
    return {
      success: true,
      message: message
    };
  } catch (error) {
    console.error('Excel数据处理错误:', error);
    return {
      success: false,
      message: 'Excel数据处理失败: ' + error.message
    };
  }
}

/**
 * 处理上传的Excel文件
 * @param {string} filePath Excel文件路径
 * @returns {Promise<{success: boolean, message: string}>} 处理结果
 */
export async function processExcelFile(filePath) {
  try {
    console.log(`尝试处理Excel文件: ${filePath}`);
    
    // 处理相对URL路径
    const fileUrl = filePath.startsWith('/') 
      ? `${window.location.origin}${filePath}` 
      : filePath;
    
    console.log(`完整文件URL: ${fileUrl}`);
    
    // 使用fetch获取文件
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error(`无法获取文件: ${response.status} ${response.statusText}`);
      return {
        success: false,
        message: `无法获取文件: ${response.status} ${response.statusText}`
      };
    }
    
    // 将文件转换为ArrayBuffer
    const fileBuffer = await response.arrayBuffer();
    
    // 读取Excel文件
    console.log('开始读取Excel文件...');
    const workbook = XLSX.read(new Uint8Array(fileBuffer), {type: 'array'});
    const sheetName = workbook.SheetNames[0]; // 默认使用第一个工作表
    const worksheet = workbook.Sheets[sheetName];
    
    // 将工作表转换为JSON对象数组
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    console.log(`读取到 ${rows.length} 行数据`);
    
    // 使用通用处理函数处理Excel数据
    return await processExcelRowsFromMemory(rows);
    
  } catch (error) {
    console.error('Excel processing error:', error);
    return {
      success: false,
      message: 'Excel文件处理失败: ' + error.message
    };
  }
}

/**
 * 从Excel行数据中解析问题
 * @param {Array<Array>} rows Excel数据行
 * @returns {Array<{content: string, options: Array<string>, answer: string, explanation: string}>} 解析出的问题数组
 */
function parseQuestionsFromExcel(rows) {
  const questions = [];
  const headerRow = rows[0];
  
  console.log('表格标题行:', headerRow);
  
  // 尝试确定列的索引
  // 特别检查"题干"列
  let questionColIndex = -1;
  // 打印所有列名用于调试
  console.log('所有列名:', headerRow.map(col => String(col).trim()));
  
  // 尝试检测序号列，用于辅助定位其他列
  const serialNumIndex = headerRow.findIndex(col => {
    const colStr = String(col).trim();
    return /^序号$|^编号$|^[Nn][Oo]\.?$|^[Ii][Dd]$|^#$/.test(colStr);
  });
  
  if (serialNumIndex !== -1) {
    console.log(`找到序号列: ${serialNumIndex}, 列名: "${String(headerRow[serialNumIndex]).trim()}"`);
  }
  
  // 尝试多种可能的匹配方式查找题目列
  for (let i = 0; i < headerRow.length; i++) {
    const colName = String(headerRow[i]).trim();
    console.log(`检查题目列 ${i}: "${colName}"`);
    
    // 精确匹配"题干"
    if (colName === '题干') {
      console.log(`找到精确匹配的题干列: ${i}`);
      questionColIndex = i;
      break;
    }
    
    // 包含"题干"的列名
    if (colName.includes('题干')) {
      console.log(`找到包含题干的列: ${i}`);
      questionColIndex = i;
      break;
    }
    
    // 精确匹配常见题目列名
    if (/^问题$|^题目$|^试题$|^题$/.test(colName)) {
      console.log(`找到精确匹配的题目列: ${i}`);
      questionColIndex = i;
      break;
    }
  }
  
  // 如果仍然没找到，尝试其他可能的列名
  if (questionColIndex === -1) {
    for (let i = 0; i < headerRow.length; i++) {
      const colName = String(headerRow[i]).trim();
      
      // 使用关键词匹配
      if (/问题|题目|内容|试题|题干|question|content/i.test(colName)) {
        console.log(`通过关键词匹配找到题目列: ${i}, 列名: "${colName}"`);
        questionColIndex = i;
        break;
      }
    }
  }
  
  // 知识点列检测
  let knowledgeColIndex = -1;
  for (let i = 0; i < headerRow.length; i++) {
    const colName = String(headerRow[i]).trim();
    if (/知识点|knowledge|要点|知识|points/i.test(colName)) {
      console.log(`找到知识点列: ${i}, 列名: "${colName}"`);
      knowledgeColIndex = i;
      break;
    }
  }
  
  // 增强选项列检测
  let optionsColIndex = -1;
  console.log('正在查找选项列...');
  
  // 精确匹配选项列
  for (let i = 0; i < headerRow.length; i++) {
    const colName = String(headerRow[i]).trim();
    if (/^选项$|^options$/i.test(colName)) {
      console.log(`找到精确匹配的选项列: ${i}, 列名: "${colName}"`);
      optionsColIndex = i;
      break;
    }
  }
  
  // 如果精确匹配失败，使用宽松匹配
  if (optionsColIndex === -1) {
    for (let i = 0; i < headerRow.length; i++) {
      const colName = String(headerRow[i]).trim();
      if (/选项|option|备选|答案选项|choices/i.test(colName)) {
        console.log(`通过关键词匹配找到选项列: ${i}, 列名: "${colName}"`);
        optionsColIndex = i;
        break;
      }
    }
  }
  
  // 检查是否有单独的A、B、C、D选项列
  let hasIndividualOptionCols = false;
  let optionColA = headerRow.findIndex(col => /^[Aa]$|^选项[Aa]$|^[Aa]选项$/.test(String(col).trim()));
  let optionColB = headerRow.findIndex(col => /^[Bb]$|^选项[Bb]$|^[Bb]选项$/.test(String(col).trim()));
  let optionColC = headerRow.findIndex(col => /^[Cc]$|^选项[Cc]$|^[Cc]选项$/.test(String(col).trim()));
  let optionColD = headerRow.findIndex(col => /^[Dd]$|^选项[Dd]$|^[Dd]选项$/.test(String(col).trim()));
  
  if (optionColA !== -1 && optionColB !== -1 && optionColC !== -1 && optionColD !== -1) {
    hasIndividualOptionCols = true;
    console.log(`发现单独的选项列: A列: ${optionColA}, B列: ${optionColB}, C列: ${optionColC}, D列: ${optionColD}`);
  }
  
  if (optionsColIndex === -1 && !hasIndividualOptionCols) {
    console.log('未找到选项列，将尝试从题干中提取或使用默认布局');
  }
  
  // 增强对答案列的识别能力
  let answerColIndex = -1;
  console.log('正在查找答案列...');
  
  // 精确匹配常见答案列名
  for (let i = 0; i < headerRow.length; i++) {
    const colName = String(headerRow[i]).trim();
    // 检查精确匹配的答案列名
    if (/^答案$|^正确答案$|^参考答案$/.test(colName)) {
      console.log(`找到精确匹配的答案列: ${i}, 列名: "${colName}"`);
      answerColIndex = i;
      break;
    }
  }
  
  // 如果精确匹配失败，使用宽松匹配
  if (answerColIndex === -1) {
    answerColIndex = headerRow.findIndex(col => {
      const colStr = String(col).trim();
      return /答案|正确|correct|answer/.test(colStr);
    });
    
    if (answerColIndex !== -1) {
      console.log(`通过关键词匹配找到答案列: ${answerColIndex}, 列名: "${String(headerRow[answerColIndex]).trim()}"`);
    } else {
      console.log('未找到答案列，尝试查找其他可能的答案列...');
      
      // 尝试查找含有"answer"的英文列名（不区分大小写）
      answerColIndex = headerRow.findIndex(col => 
        String(col).toLowerCase().includes('answer') || 
        String(col).toLowerCase().includes('correct')
      );
      
      if (answerColIndex !== -1) {
        console.log(`找到英文答案列: ${answerColIndex}, 列名: "${String(headerRow[answerColIndex]).trim()}"`);
      }
    }
  }
  
  // 如果仍然找不到答案列，尝试从标题行的内容推断
  if (answerColIndex === -1) {
    // 查找标题行中任何可能是答案的列
    for (let i = 0; i < headerRow.length; i++) {
      const colName = String(headerRow[i]).trim().toLowerCase();
      if (colName.includes('答') || colName.includes('对') || 
          colName.includes('正') || colName.includes('解') ||
          colName === 'key' || colName === 'result') {
        console.log(`发现可能的答案列: ${i}, 列名: "${colName}"`);
        answerColIndex = i;
        break;
      }
    }
  }
  
  console.log('最终确定的答案列索引:', answerColIndex);
  
  // 改进解析列检测
  let explanationColIndex = -1;
  console.log('正在查找解析列...');
  
  // 精确匹配解析列名
  for (let i = 0; i < headerRow.length; i++) {
    const colName = String(headerRow[i]).trim();
    console.log(`检查解析列 ${i}: "${colName}"`);
    
    // 精确匹配"解析"
    if (/^解析$|^答案解析$|^explanation$|^解释$/i.test(colName)) {
      console.log(`找到精确匹配的解析列: ${i}`);
      explanationColIndex = i;
      break;
    }
  }
  
  // 如果精确匹配失败，使用宽松匹配
  if (explanationColIndex === -1) {
    for (let i = 0; i < headerRow.length; i++) {
      const colName = String(headerRow[i]).trim();
      
      // 使用关键词匹配
      if (/解析|explanation|解释|分析|说明|讲解|detail|analyze|analysis/i.test(colName)) {
        console.log(`通过关键词匹配找到解析列: ${i}, 列名: "${colName}"`);
        explanationColIndex = i;
        break;
      }
    }
  }
  
  // 如果仍然没找到解析列，使用启发式规则
  if (explanationColIndex === -1) {
    console.log('未找到明确的解析列，尝试使用启发式规则');
    
    // 如果找到了答案列，默认解析列可能在答案列之后
    if (answerColIndex !== -1 && answerColIndex < headerRow.length - 1) {
      explanationColIndex = answerColIndex + 1;
      console.log(`基于答案列推断解析列为: ${explanationColIndex}, 列名: "${String(headerRow[explanationColIndex]).trim()}"`);
    }
    // 或者解析列可能是最后一列
    else if (questionColIndex !== -1) {
      // 找到最后一列，可能是解析
      const lastColIndex = headerRow.length - 1;
      // 检查最后一列是否是解析列（通过检查名称或相对位置）
      if (lastColIndex > questionColIndex && lastColIndex > answerColIndex) {
        explanationColIndex = lastColIndex;
        console.log(`假设最后一列为解析列: ${explanationColIndex}, 列名: "${String(headerRow[explanationColIndex]).trim()}"`);
      }
    }
  }
  
  // 如果无法确定，设置为默认值
  if (explanationColIndex === -1) {
    // 默认解析列可能是第三列或答案列之后的列
    explanationColIndex = answerColIndex !== -1 ? Math.min(answerColIndex + 1, headerRow.length - 1) : 2;
    console.log(`未找到解析列，使用默认索引: ${explanationColIndex}`);
  }
  
  // 查找分类列
  let categoryColIndex = headerRow.findIndex(col => /分类|类别|章节/.test(String(col)));
  
  // 添加检测结果汇总
  console.log('列检测完成，最终确定的列索引:');
  console.log('- 序号列:', serialNumIndex, serialNumIndex !== -1 ? `(${String(headerRow[serialNumIndex]).trim()})` : '(未找到)');
  console.log('- 题目列:', questionColIndex, questionColIndex !== -1 ? `(${String(headerRow[questionColIndex]).trim()})` : '(未找到)');
  console.log('- 选项列:', optionsColIndex, optionsColIndex !== -1 ? `(${String(headerRow[optionsColIndex]).trim()})` : hasIndividualOptionCols ? '(使用单独的A/B/C/D列)' : '(未找到)');
  console.log('- 答案列:', answerColIndex, answerColIndex !== -1 ? `(${String(headerRow[answerColIndex]).trim()})` : '(未找到)');
  console.log('- 解析列:', explanationColIndex, explanationColIndex !== -1 ? `(${String(headerRow[explanationColIndex]).trim()})` : '(未找到)');
  console.log('- 知识点列:', knowledgeColIndex, knowledgeColIndex !== -1 ? `(${String(headerRow[knowledgeColIndex]).trim()})` : '(未找到)');
  console.log('- 分类列:', categoryColIndex, categoryColIndex !== -1 ? `(${String(headerRow[categoryColIndex]).trim()})` : '(未找到)');
  
  if (hasIndividualOptionCols) {
    console.log('- 选项A列:', optionColA, optionColA !== -1 ? `(${String(headerRow[optionColA]).trim()})` : '(未找到)');
    console.log('- 选项B列:', optionColB, optionColB !== -1 ? `(${String(headerRow[optionColB]).trim()})` : '(未找到)');
    console.log('- 选项C列:', optionColC, optionColC !== -1 ? `(${String(headerRow[optionColC]).trim()})` : '(未找到)');
    console.log('- 选项D列:', optionColD, optionColD !== -1 ? `(${String(headerRow[optionColD]).trim()})` : '(未找到)');
  }
  
  console.log('识别的列索引: 题干:', questionColIndex, '知识点:', knowledgeColIndex, '选项:', optionsColIndex, '答案:', answerColIndex, '解析:', explanationColIndex, '分类:', categoryColIndex);
  
  // 添加详细汇总日志，显示所有检测到的列索引
  console.log('========== 列检测汇总 ==========');
  console.log(`题号列: ${serialNumIndex !== -1 ? serialNumIndex : '未找到'}`);
  console.log(`问题列: ${questionColIndex !== -1 ? questionColIndex : '未找到'}`);
  console.log(`选项列: ${optionsColIndex !== -1 ? optionsColIndex : '未找到'}`);
  console.log(`答案列: ${answerColIndex !== -1 ? answerColIndex : '未找到'}`);
  console.log(`解析列: ${explanationColIndex !== -1 ? explanationColIndex : '未找到'}`);
  console.log(`知识点列: ${knowledgeColIndex !== -1 ? knowledgeColIndex : '未找到'}`);
  console.log(`分类列: ${categoryColIndex !== -1 ? categoryColIndex : '未找到'}`);
  
  // 如果是有单独的选项列
  if (optionColA !== -1 || optionColB !== -1 || 
      optionColC !== -1 || optionColD !== -1) {
    console.log('单独选项列:');
    console.log(`  选项A列: ${optionColA !== -1 ? optionColA : '未找到'}`);
    console.log(`  选项B列: ${optionColB !== -1 ? optionColB : '未找到'}`);
    console.log(`  选项C列: ${optionColC !== -1 ? optionColC : '未找到'}`);
    console.log(`  选项D列: ${optionColD !== -1 ? optionColD : '未找到'}`);
  }
  console.log('================================');
  
  // 增加全面详细的列检测总结信息
  console.log('\n📊 Excel列检测结果综合报告 📊');
  console.log('----------------------------------------');
  
  // 序号列
  if (serialNumIndex !== -1) {
    console.log(`✅ 序号列: 在第${serialNumIndex+1}列 "${String(headerRow[serialNumIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 序号列: 未找到，将尝试使用行号作为序号');
  }
  
  // 题目列
  if (questionColIndex !== -1) {
    console.log(`✅ 题目列: 在第${questionColIndex+1}列 "${String(headerRow[questionColIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 题目列: 未找到，这可能会影响题目的正确提取');
  }
  
  // 选项处理情况综合报告
  if (optionsColIndex !== -1) {
    console.log(`✅ 选项列: 在第${optionsColIndex+1}列 "${String(headerRow[optionsColIndex]).trim()}" 成功识别`);
  } else if (hasIndividualOptionCols) {
    console.log('✅ 选项: 使用单独的A/B/C/D选项列格式');
    // 检查每个选项列的状态
    if (optionColA !== -1) {
      console.log(`  ✅ A选项: 在第${optionColA+1}列 "${String(headerRow[optionColA]).trim()}"`);
    } else {
      console.log('  ❌ A选项: 未找到');
    }
    
    if (optionColB !== -1) {
      console.log(`  ✅ B选项: 在第${optionColB+1}列 "${String(headerRow[optionColB]).trim()}"`);
    } else {
      console.log('  ❌ B选项: 未找到');
    }
    
    if (optionColC !== -1) {
      console.log(`  ✅ C选项: 在第${optionColC+1}列 "${String(headerRow[optionColC]).trim()}"`);
    } else {
      console.log('  ❌ C选项: 未找到');
    }
    
    if (optionColD !== -1) {
      console.log(`  ✅ D选项: 在第${optionColD+1}列 "${String(headerRow[optionColD]).trim()}"`);
    } else {
      console.log('  ❌ D选项: 未找到');
    }
  } else {
    console.log('❌ 选项列: 未找到，将尝试从题目内容中提取选项或使用默认选项');
  }
  
  // 答案列
  if (answerColIndex !== -1) {
    console.log(`✅ 答案列: 在第${answerColIndex+1}列 "${String(headerRow[answerColIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 答案列: 未找到，这可能会导致需要AI生成答案');
  }
  
  // 解析列
  if (explanationColIndex !== -1) {
    console.log(`✅ 解析列: 在第${explanationColIndex+1}列 "${String(headerRow[explanationColIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 解析列: 未找到，将没有解析信息或需要AI生成');
  }
  
  // 知识点列
  if (knowledgeColIndex !== -1) {
    console.log(`✅ 知识点列: 在第${knowledgeColIndex+1}列 "${String(headerRow[knowledgeColIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 知识点列: 未找到，题目将没有知识点标记');
  }
  
  // 分类列
  if (categoryColIndex !== -1) {
    console.log(`✅ 分类列: 在第${categoryColIndex+1}列 "${String(headerRow[categoryColIndex]).trim()}" 成功识别`);
  } else {
    console.log('❌ 分类列: 未找到，将使用AI自动分类');
  }
  
  console.log('----------------------------------------');
  console.log(`📝 总结: 识别出 ${[serialNumIndex, questionColIndex, optionsColIndex, answerColIndex, explanationColIndex, knowledgeColIndex, categoryColIndex].filter(idx => idx !== -1).length} 个有效列`);
  console.log(`🔍 总行数: ${rows.length}, 预计可处理题目数: ${rows.length - 1}`);
  console.log('----------------------------------------\n');
  
  // 检查是否包含英文字母作为列标题
  const hasLetterColumns = headerRow.some(col => /^[A-D]$/.test(String(col).trim()));
  
  const hasOptionColumns = (optionColA !== -1 && optionColB !== -1) || hasLetterColumns;
  
  console.log('选项列索引: A:', optionColA, 'B:', optionColB, 'C:', optionColC, 'D:', optionColD);
  console.log('是否使用选项列格式:', hasOptionColumns, '是否包含字母列:', hasLetterColumns);
  
  // 如果没有找到标准列头，尝试使用默认索引
  if (questionColIndex === -1) {
    // 尝试寻找一些特殊列，如序号列或第一列
    if (serialNumIndex !== -1) {
      console.log('未找到题目列，但找到序号列，使用序号后一列或第二列作为题目');
      questionColIndex = Math.min(serialNumIndex + 1, 1);
    } else {
      console.log('未找到题目列，使用默认列索引 0');
      questionColIndex = 0;
    }
  }
  
  // 改进答案列的默认处理逻辑
  if (answerColIndex === -1) {
    console.log('未找到答案列，尝试推断答案列位置');
    
    // 如果有题目列和选项列，答案列可能在它们后面
    if (questionColIndex !== -1) {
      // 答案列通常在题目列之后，或在选项列之后
      const potentialAnswerColIndex = optionsColIndex !== -1 
        ? optionsColIndex + 1 
        : questionColIndex + 1;
      
      if (potentialAnswerColIndex < headerRow.length) {
        answerColIndex = potentialAnswerColIndex;
        console.log(`基于列位置推断答案列: ${answerColIndex}`);
      } else if (headerRow.length > 1) {
        // 如果所有推断都失败，使用默认的第2列
        answerColIndex = 1;
        console.log(`使用默认列索引 1 作为答案列`);
      }
    } else if (headerRow.length > 1) {
      // 如果没有题目列但有多列，使用第2列
      answerColIndex = 1;
      console.log(`使用默认列索引 1 作为答案列`);
    }
  }
  
  if (explanationColIndex === -1 && headerRow.length > 2) {
    console.log('未找到解析列，使用默认列索引 2');
    explanationColIndex = 2;
  }
  
  // 查找"选项"模式的特殊格式，如"选项A"、"选项B"等
  const optionPattern = /^选项([A-D])$|^选项 ([A-D])$|^([A-D])选项$|^选择([A-D])$/;
  const optionIndices = {};
  
  headerRow.forEach((col, index) => {
    const match = String(col).match(optionPattern);
    if (match) {
      const letter = match[1] || match[2] || match[3] || match[4];
      optionIndices[letter] = index;
      console.log(`找到选项${letter}列: ${index}`);
    }
  });
  
  // 查找选择题的特殊格式，如"A (正确答案)", "B", "C", "D"
  const optionLetterIndices = {};
  headerRow.forEach((col, index) => {
    if (/^[A-D](\s.*)?$/.test(String(col).trim())) {
      const letter = String(col).trim()[0];
      optionLetterIndices[letter] = index;
      console.log(`找到选项${letter}列: ${index}`);
    }
  });
  
  console.log('处理数据行数:', rows.length - 1);
  
  // 处理每一行数据（跳过标题行）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // 跳过空行
    if (row.length === 0 || (row.length === 1 && !row[0])) {
      console.log(`跳过第 ${i+1} 行: 空行`);
      continue;
    }
    
    console.log(`处理第 ${i+1} 行: `, JSON.stringify(row).substring(0, 100) + '...');
    
    // 获取题目内容
    let content = questionColIndex >= 0 && questionColIndex < row.length ? String(row[questionColIndex]) : '';
    
    // 获取知识点（如果有）
    let knowledge = '';
    if (knowledgeColIndex !== -1 && knowledgeColIndex < row.length) {
      knowledge = String(row[knowledgeColIndex]).trim();
    }
    
    // 序号特殊处理 - 如果有序号列但没题目内容，可能题目在其他位置
    if ((!content || /^\d+$/.test(content.trim())) && serialNumIndex !== -1) {
      // 检查是否有序号
      const serialNum = row[serialNumIndex] ? String(row[serialNumIndex]).trim() : '';
      console.log(`序号: ${serialNum}, 当前题目内容: "${content}"`);
      
      // 如果序号是数字，但题目为空或也是数字，尝试找其他可能的题目列
      if (/^\d+$/.test(serialNum)) {
        // 查找可能包含题目的列 - 优先查找序号后面的列
        for (let j = 0; j < row.length; j++) {
          if (j === serialNumIndex || j === knowledgeColIndex || j === optionsColIndex || j === answerColIndex || j === explanationColIndex) {
            continue; // 跳过已知的序号、知识点、选项、答案和解析列
          }
          
          const potentialContent = String(row[j]);
          if (potentialContent && potentialContent.length > 5 && !/^\d+$/.test(potentialContent.trim())) {
            console.log(`找到可能的题目内容: "${potentialContent.substring(0, 30)}..."`);
            content = potentialContent;
            questionColIndex = j; // 更新题目列索引以便后续处理
            break;
          }
        }
      }
    }
    
    // 仍然没有找到有效题目内容，尝试用序号作为题目
    if (!content && serialNumIndex !== -1 && serialNumIndex < row.length) {
      const serialNum = String(row[serialNumIndex]).trim();
      if (serialNum) {
        console.log(`使用序号 ${serialNum} 作为题目标识`);
        content = `题目 ${serialNum}`;
      }
    }
    
    if (!content) {
      console.log(`跳过第 ${i+1} 行: 题目内容为空`);
      continue; // 如果没有题目内容，跳过此行
    }
    
    // 获取分类信息（如果有）
    const category = categoryColIndex !== -1 && categoryColIndex < row.length ? String(row[categoryColIndex]) : '';
    
    // 如果有知识点，添加到题目内容中
    if (knowledge && content !== knowledge) {
      content = `${content}\n\n知识点: ${knowledge}`;
    }
    
    // 解析选项
    let options = [];
    
    // 如果使用选项列格式 (A, B, C, D在不同列)
    if (hasOptionColumns) {
      console.log('使用选项列格式解析选项');
      
      // 首先尝试使用optionIndices（选项A, 选项B等）
      if (Object.keys(optionIndices).length > 0) {
        console.log('使用"选项X"格式解析');
        for (const [letter, idx] of Object.entries(optionIndices)) {
          if (idx < row.length && row[idx]) {
            const optionText = String(row[idx]).trim();
            if (optionText) {
              options.push(`${letter}. ${optionText}`);
            }
          }
        }
      }
      // 然后尝试使用optionLetterIndices（A, B, C, D等）
      else if (Object.keys(optionLetterIndices).length > 0) {
        console.log('使用字母列格式解析');
        for (const [letter, idx] of Object.entries(optionLetterIndices)) {
          if (idx < row.length && row[idx]) {
            const optionText = String(row[idx]).trim();
            if (optionText && optionText !== letter) {
              options.push(`${letter}. ${optionText.replace(/^[A-D][.。：:\s]*/, '')}`);
            }
          }
        }
      }
      // 最后尝试使用optionAIndex等
      else {
        console.log('使用选项索引格式解析');
        const optionIndexes = [optionColA, optionColB, optionColC, optionColD];
        const optionLabels = ['A', 'B', 'C', 'D'];
        
        for (let j = 0; j < optionIndexes.length; j++) {
          const idx = optionIndexes[j];
          if (idx !== -1 && idx < row.length && row[idx]) {
            const optionText = String(row[idx]).trim();
            if (optionText) {
              options.push(`${optionLabels[j]}. ${optionText}`);
            }
          }
        }
      }
    }
    // 如果有专门的选项列
    else if (optionsColIndex !== -1 && optionsColIndex < row.length) {
      const optionsText = String(row[optionsColIndex]);
      console.log(`从选项列 ${optionsColIndex} 解析选项: "${optionsText.substring(0, 50)}..."`);
      // 尝试将选项文本分割成单独的选项
      options = parseOptionsFromText(optionsText);
    } 
    // 如果没有专门的选项列，尝试从题目内容中解析选项
    else {
      console.log('尝试从题目内容中提取选项');
      const originalContent = content; // 保存原始内容以便提取选项
      options = extractOptionsFromContent(originalContent);
      
      // 如果从题目中提取了选项，考虑清理题目内容
      if (options.length > 0) {
        const cleanedContent = cleanContent(content, options);
        if (cleanedContent.trim() && cleanedContent !== content) {
          console.log(`清理后的题目内容: "${cleanedContent.substring(0, 30)}..."`);
          content = cleanedContent;
        } else {
          console.log('题目内容保持不变，包含选项');
        }
      }
    }
    
    // 如果仍然没有选项，尝试从相邻列获取
    if (options.length === 0 && row.length > questionColIndex + 1) {
      console.log('尝试从题目右侧列获取选项');
      
      // 尝试检查题目旁边的列是否包含选项
      const potentialOptionsCol = questionColIndex + 1;
      if (potentialOptionsCol < row.length) {
        const optionsText = String(row[potentialOptionsCol]);
        if (optionsText) {
          options = parseOptionsFromText(optionsText);
        }
      }
    }
    
    console.log(`解析到的选项数量: ${options.length}`);
    if (options.length > 0) {
      console.log(`选项内容(前2个): ${options.slice(0, 2).join(' | ')}`);
    } else {
      console.log('警告: 未能解析出选项');
    }
    
    // 获取答案和解析
    let answer = '';
    if (answerColIndex !== -1 && row[answerColIndex]) {
      answer = String(row[answerColIndex]).trim();
      console.log(`原始答案: "${answer}"`);
      
      // 规范化答案格式
      if (/^[A-D]+$/i.test(answer)) {
        // 如果答案只包含A-D字母，保持原样
        answer = answer.toUpperCase();
      } else if (/[A-D]/i.test(answer)) {
        // 如果答案包含A-D字母以及其他内容，提取字母部分
        const letterMatch = answer.match(/[A-D]+/i);
        if (letterMatch) {
          answer = letterMatch[0].toUpperCase();
        }
      }
      
      console.log(`处理后的答案: "${answer}"`);
    }
    const explanation = explanationColIndex !== -1 && explanationColIndex < row.length ? String(row[explanationColIndex]) : '';
    
    console.log(`题目 ${i}: 内容="${content.substring(0, 30)}...", 答案="${answer}", 解析长度=${explanation.length}, 分类="${category}"`);
    
    // 如果题目内容还是空或只包含数字，但有选项，尝试构建一个题目
    if ((!content || /^\d+$/.test(content.trim())) && options.length > 0) {
      const serialNum = serialNumIndex !== -1 && row[serialNumIndex] ? String(row[serialNumIndex]).trim() : String(i);
      content = `题目 ${serialNum}`;
      console.log(`构建默认题目内容: "${content}"`);
    }
    
    questions.push({
      content: content, // 不再使用cleanContent函数，避免丢失题目内容
      options,
      answer,
      explanation,
      category
    });
    
    console.log(`成功添加第 ${questions.length} 道题目`);
  }
  
  console.log(`总共从Excel中解析出 ${questions.length} 道题目`);
  return questions;
}

/**
 * 从文本中解析选项
 * @param {string} optionsText 选项文本
 * @returns {Array<string>} 选项数组
 */
function parseOptionsFromText(optionsText) {
  if (!optionsText) return [];
  
  console.log('解析选项文本:', optionsText.substring(0, 100) + (optionsText.length > 100 ? '...' : ''));
  
  // 尝试按新行或分号分割
  let options = [];
  
  // 检查是否包含 A.、B.、C.、D. 模式
  const containsOptionPattern = /[A-D][.。：:\s]*.+/i.test(optionsText);
  
  if (containsOptionPattern) {
    console.log('检测到A.B.C.D.格式');
    // 尝试匹配选项格式
    const optMatches = optionsText.match(/[A-D][.。：:\s]+[A-D][.。：:\s]+?(?=[A-D][.。：:\s]|$)/g);
    if (optMatches) {
      options = optMatches.map(opt => opt.trim());
      console.log('成功匹配选项格式，提取到', options.length, '个选项');
    }
  } 
  else if (optionsText.includes('\n')) {
    console.log('按换行符分割');
    options = optionsText.split('\n')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
    
    // 检查拆分后的选项是否包含选项标记 (A, B, C, D)
    const hasMarkers = options.some(opt => /^[A-D][.。：:\s]/.test(opt));
    if (!hasMarkers && options.length >= 4) {
      // 如果没有标记但有至少4个选项，添加标记
      console.log('添加A.B.C.D.标记');
      const labels = ['A', 'B', 'C', 'D'];
      options = options.slice(0, 4).map((opt, idx) => `${labels[idx]}. ${opt}`);
    }
  } 
  else if (optionsText.includes(';') || optionsText.includes('；')) {
    console.log('按分号分割');
    options = optionsText.split(/[;；]/)
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
    
    // 检查拆分后的选项是否包含选项标记 (A, B, C, D)
    const hasMarkers = options.some(opt => /^[A-D][.。：:\s]/.test(opt));
    if (!hasMarkers && options.length >= 4) {
      // 如果没有标记但有至少4个选项，添加标记
      console.log('添加A.B.C.D.标记');
      const labels = ['A', 'B', 'C', 'D'];
      options = options.slice(0, 4).map((opt, idx) => `${labels[idx]}. ${opt}`);
    }
  }
  // 检查特殊格式：选项直接并排 (如 "A:选项1 B:选项2 C:选项3 D:选项4")
  else if (/[A-D][.:：]\s*\S+/.test(optionsText)) {
    console.log('检测到选项并排格式');
    const optMatches = optionsText.match(/[A-D][.:：]\s*[^A-D.:：]+/g);
    if (optMatches) {
      options = optMatches.map(opt => {
        // 转换为标准格式 "A. 选项1"
        const letter = opt.charAt(0);
        const content = opt.substring(opt.search(/\s*\S/)).trim();
        return `${letter}. ${content}`;
      });
    }
  }
  
  // 如果以上方法都没提取到选项，尝试其他方法
  if (options.length === 0) {
    console.log('使用更宽松的模式匹配选项');
    // 尝试找出所有以A/B/C/D开头的文本块
    const looseMatches = optionsText.match(/(?:^|\s)[A-D][)）.:：、\s]\s*[^A-D]+/g);
    if (looseMatches && looseMatches.length > 0) {
      options = looseMatches.map(opt => {
        opt = opt.trim();
        const letter = opt.charAt(0);
        let content = opt.substring(1).trim();
        // 移除开头的分隔符
        content = content.replace(/^[)）.:：、\s]+/, '').trim();
        return `${letter}. ${content}`;
      });
    }
  }
  
  console.log('解析结果:', options.length > 0 ? options : '未能提取选项');
  return options;
}

/**
 * 从题目内容中提取选项
 * @param {string} content 题目内容
 * @returns {Array<string>} 提取出的选项
 */
function extractOptionsFromContent(content) {
  console.log('尝试从题目内容中提取选项:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
  
  const options = [];
  
  // 查找像"A. 选项内容"这样的模式
  const optionPattern = /([A-D][.。）:：]\s*)([^A-D.。）:：]{2,}?)(?=\s*[A-D][.。）:：]|$)/g;
  let match;
  
  while ((match = optionPattern.exec(content)) !== null) {
    const marker = match[1].trim();
    const text = match[2].trim();
    const letter = marker.charAt(0);
    
    // 确保这是一个有效的选项(长度适中，不是题号)
    if (text.length > 1 && !/^\d+$/.test(text)) {
      options.push(`${letter}. ${text}`);
    }
  }
  
  // 如果没有找到选项，尝试其他模式
  if (options.length === 0) {
    // 寻找格式如 A 选项1 B 选项2 的模式
    const alternativePattern = /\b([A-D])\s+([^A-D\s][^\n]+?)(?=\s+[A-D]\s+|\s*$)/g;
    while ((match = alternativePattern.exec(content)) !== null) {
      const letter = match[1];
      const text = match[2].trim();
      
      // 确保这是一个有效的选项
      if (text.length > 1) {
        options.push(`${letter}. ${text}`);
      }
    }
  }
  
  console.log('从题目内容提取结果:', options.length > 0 ? options : '未能提取选项');
  return options;
}

/**
 * 清理题目内容，如果选项已经分离，则从内容中移除选项
 * @param {string} content 原始题目内容
 * @param {Array<string>} options 已分离的选项
 * @returns {string} 清理后的内容
 */
function cleanContent(content, options) {
  if (!content || options.length === 0) {
    return content;
  }
  
  console.log(`清理题目内容, 原内容: "${content.substring(0, 50)}...", 选项数量: ${options.length}`);
  
  let cleanedContent = content;
  
  // 检查题目是否包含选项
  let containsOptions = false;
  for (const option of options) {
    // 提取选项标记 (A., B., 等)
    const optionMarker = option.match(/^([A-D][.。])\s*/);
    if (optionMarker && content.includes(optionMarker[1])) {
      containsOptions = true;
      break;
    }
  }
  
  // 只有当题目明确包含选项时才进行清理
  if (containsOptions) {
    // 只尝试移除明确的选项部分
    for (const option of options) {
      const marker = option.match(/^([A-D][.。])\s*/);
      if (marker) {
        // 查找选项在题目中的完整匹配
        const optionPattern = new RegExp(`${marker[1]}\\s*[^A-D.。]+`, 'g');
        cleanedContent = cleanedContent.replace(optionPattern, '');
      }
    }
    
    // 清理剩余的选项标记 (A., B., 等)
    cleanedContent = cleanedContent.replace(/[A-D][.。]\s*(?=[A-D][.。]|$)/g, '');
    
    // 清理可能的额外空白和标点
    cleanedContent = cleanedContent.replace(/\s*[;；]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 检查清理后内容是否有意义
    if (!cleanedContent || cleanedContent.length < 5) {
      console.log('清理后内容太短，保留原始内容');
      return content;
    }
  } else {
    console.log('题目中未检测到选项标记，保留原始内容');
    return content;
  }
  
  console.log(`清理后的题目内容: "${cleanedContent.substring(0, 50)}..."`);
  return cleanedContent;
}

/**
 * 处理单个问题
 * @param {Object} question 问题对象
 * @returns {Promise<void>}
 */
async function processQuestion(question) {
  try {
    // 如果问题没有答案，使用AI生成一个
    if (!question.answer) {
      // 添加一个简单的超时防止API调用过多
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('使用AI分析问题:', question.content.substring(0, 30) + '...');
      const aiResult = await analyzeQuestion(question.content);
      question.answer = aiResult.answer;
      question.explanation = aiResult.explanation;
      console.log('AI生成答案:', question.answer);
    }
    
    // 如果问题没有分类，使用AI生成一个
    let category = '未分类';
    try {
      if (question.category) {
        category = question.category;
      } else {
        // 添加一个简单的超时防止API调用过多
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('使用AI分类问题');
        category = await categorizeQuestion(question.content);
        console.log('AI分类结果:', category);
      }
    } catch (error) {
      console.error('Error categorizing question:', error);
    }
    
    // 将问题添加到数据库
    console.log('将问题添加到数据库，分类:', category);
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