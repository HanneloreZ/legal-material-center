# 文档与图片工作台

本地版本1.3.1新增 `/materials/`。42种可编辑文书结构模板按七类法律业务组织，另有聊天、网页、考勤、流程图四类合成图片。专家已有文件通过原件路线接收。现有财务与普通台账逻辑未修改，本轮没有新增表格模型或公式工作簿。

## 页面使用

双击根目录的 `启动文档图片工作台.command` 可打开本地预览；该脚本会复用同端口的现有工作台，关闭启动窗口会停止本次新启动的服务。也可运行 `npm run dev`。

从素材中心进入“文档与图片”，选择文书门类或图片类型，修改字段与正文，选择输出并制作。文书输出DOCX、A4可检索PDF，也可逐页输出PNG/SVG。图片输出PNG、SVG、可检索PDF及内容转录DOCX；聊天长消息、网页长文和图示说明会续页，考勤按条输出。生成内容保留合成标识。

文书目录提供字段、章节和合成结构示例，正文由使用者按材料编辑。它不是自动撰写法律意见或法律结论的引擎；证件、许可、鉴定、报关等类型是资料记载模板，不等同于真实凭证的官方版式。用户审查包中未经确认的个人信息、客户原件、签章、身份图像和真实业务数据没有加入模板资源。

在窄屏中，可收起模板选择，并切换“编辑材料”和“查看预览”。本次材料与格式选择存入IndexedDB，刷新恢复；导出全部方案可备份当前工作区。原件大于12MB或整批JSON超过20MB时需要分批处理。

## 原件接收

支持PDF、DOCX、PNG、JPG/JPEG、TXT、MD，每份最多12MB。原件保留原始字节、格式和SHA256，不接受或拒绝Word修订、不自动OCR、不转码，也不改写签章或脱敏内容。DOCX可查看修订、批注和图片数量及非权威文字预览；PDF页数未验证时保持null，不从扫描文字或正则推算页数。

来源类型为unknown、expert、client、public；脱敏核对记录为not_checked、user_declared、reviewed。这些是使用者声明。`redaction_verified_by_workbench`始终为false，界面不会从选择项宣称工作台验证过脱敏。

原件DOCX保留http/https/mailto超链接，预览不主动访问。嵌入二进制对象、宏、外部模板等不支持接收。原有生成件的收集器规则不变，只有producer=original可保留上述网页超链接。原件接收并不代表文档内容、来源、脱敏或法律效力通过审核。

## 批量接口

批次协议继续为material-batch/1，制件版本为material-render/1.3.0。新增引擎及payload：

| engine | payload | 原生输出 |
| --- | --- | --- |
| documents | `{document: legal-document/1}` | docx/pdf/png/svg |
| images | `{image: legal-image/1}` | pdf/png/svg/docx（转录） |
| original | `{original: original-document/1}` | 原文件的唯一格式 |

`get_capabilities`提供实际目录、范围和限制，`get_template`提供文书/图片完整示例。original的模板接口只说明所需字段，不制造虚构原件。批量页面能导入三种独立方案，并有“载入文档图片示例”按钮。标准JSON示例位于 `online/public/examples/materials/`，七门类加四类图片的批次位于 `online/public/examples/materials-smoke.batch.json`。

原件包含file.name、format、bytes、sha256、data_base64和source对象。`source_record`进入私有制作记录和文件映射，candidate业务包只含实际文件。下载收集器核对原件SHA256、字节数与source_record，保留真实producer=original及浏览器origin，不把原件改标为native或现有制件引擎。

后端Reference计划、producer schema、路由和gate需要显式扩展documents/images/original后才能启用这些浏览器路线。本轮未修改现有Pipeline YAML、Worker资源包或其准入契约。未接入前不能把这些产物伪装成现有producer；仍需按实际文件做独立检查与回收。

## 兼容性

render版本增加后，旧批次须重新保存输入以更新摘要，避免复用旧制件结果。未变更旧引擎的数据模型、财务公式或台账样式。开发入口 `npm run dev`，本地端口3016；构建沿用现有GitHub Pages配置和VITE_BASE_PATH。

## 验证

`npm test`包含旧证照、合同、第一批、第二批、Python收集器和新增materials检查。新增检查覆盖42种DOCX、七门类代表A4 PDF及文字提取、四类图片与转录、长文续页、长消息续页、12节点图、原件修订/批注/超链接保留、七种原件格式、字节哈希、双包实际回收与IndexedDB恢复。`npm run build`生成schema和公开合成示例，并构建静态页面。

浏览器验收及最终运行记录保存在本地 `work/materials-qa/`，不随模板公开。当前是本地工作副本更新，尚未发布线上。

## 通用法律研究备忘录

1.3.1增加“阶段性法律研究备忘录”，在七个业务门类下均可选择。记录研究问题、事实与假设、材料来源、初步分析、相反观点、待核事项与版本复核状态。内部法律意见可以作为本类Reference正文，使用者需保留原有初步性、时间与事实限制，不自动升级为审定意见。

备忘录日期、事实资料截止日和法律研究截止日分别使用`{{备忘录日期}}`、`{{事实资料截止日}}`、`{{法律研究截止日}}`。修改对应字段后，正文中的同名占位符自动替换；未填时保留占位符，不取系统日期。法规年份、生效日期等法律事实仍由正文独立输入。

用户提供的BVI英文稿仅用于本次私有中文模板整理，不进入公开示例资源。公开示例为不含客户、作者身份及个案法律结论的通用合成结构。
