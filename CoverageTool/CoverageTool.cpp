#include "CoverageTool.h"

#include <QApplication>
#include <QCheckBox>
#include <QComboBox>
#include <QDateTime>
#include <QDesktopServices>
#include <QDir>
#include <QDirIterator>
#include <QFileDialog>
#include <QFileInfo>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QLocale>
#include <QPlainTextEdit>
#include <QProcess>
#include <QPushButton>
#include <QSettings>
#include <QSignalBlocker>
#include <QStandardPaths>
#include <QStyle>
#include <QTextEdit>
#include <QUrl>
#include <QVBoxLayout>

namespace
{
constexpr auto kOrganizationName = "CoverageTool";
constexpr auto kApplicationName = "CoverageTool";
constexpr auto kDefaultCoverageExe = "OpenCppCoverage.exe";
constexpr auto kOpenCppCoverageUrl = "https://github.com/OpenCppCoverage/OpenCppCoverage";
constexpr auto kSettingsLanguage = "Language";
constexpr auto kLanguageEnglish = "en";
constexpr auto kLanguageChinese = "zh";

struct Translation
{
    const char *source;
    const char *chinese;
};

const Translation kTranslations[] = {
    {"Ready. Configure OpenCppCoverage and target paths, then start coverage.",
     "就绪。请配置 OpenCppCoverage 和目标路径，然后开始覆盖率分析。"},
    {"CoverageTool", "CoverageTool"},
    {"Language", "语言"},
    {"English", "English"},
    {"Chinese", "中文"},
    {"Coverage settings", "覆盖率设置"},
    {"OpenCppCoverage status", "OpenCppCoverage 状态"},
    {"Found in PATH: %1", "已在 PATH 中找到：%1"},
    {"Not found in PATH. Install OpenCppCoverage and add it to PATH.",
     "未在 PATH 中找到。请安装 OpenCppCoverage 并将其加入 PATH。"},
    {"Refresh", "重新检测"},
    {"Download", "下载安装"},
    {"Application executable to run under coverage", "需要进行覆盖率分析的应用程序"},
    {"Working directory: %1", "工作目录：%1"},
    {"Select an application to infer the working directory.",
     "选择目标程序后自动使用其所在目录作为工作目录。"},
    {"Source root used by OpenCppCoverage --sources", "OpenCppCoverage --sources 使用的源码根目录"},
    {"Optional original PDB source path prefix for --substitute_pdb_source_path",
     "可选；用于 --substitute_pdb_source_path 的 PDB 原始源码路径前缀"},
    {"Directory for HTML, COV and Cobertura XML output", "HTML、COV 和 Cobertura XML 输出目录"},
    {"Browse...", "浏览..."},
    {"Target executable", "目标程序"},
    {"Source directory", "源码目录"},
    {"PDB source path", "PDB 源码路径"},
    {"Output directory", "输出目录"},
    {"One excluded source path per line", "每行一个要排除的源码路径"},
    {"Excluded sources", "排除源码"},
    {"Optional extra OpenCppCoverage arguments", "可选的额外 OpenCppCoverage 参数"},
    {"Extra arguments", "额外参数"},
    {"Cover child processes", "覆盖子进程"},
    {"Use optimized build mode", "使用优化构建模式"},
    {"Options", "选项"},
    {"Run coverage", "运行覆盖率"},
    {"Open output", "打开输出"},
    {"Save settings", "保存设置"},
    {"Reload settings", "重新加载设置"},
    {"Merge coverage files", "合并覆盖率文件"},
    {"Directory containing .cov files", "包含 .cov 文件的目录"},
    {"COV directory", "COV 目录"},
    {"Merge COV files", "合并 COV 文件"},
    {"Open merge output", "打开合并输出"},
    {"Log", "日志"},
    {"Clear log", "清空日志"},
    {"Select target executable", "选择目标程序"},
    {"Executable (*.exe)", "可执行文件 (*.exe)"},
    {"Select source directory", "选择源码目录"},
    {"Select PDB source path", "选择 PDB 源码路径"},
    {"Select output directory", "选择输出目录"},
    {"Select COV directory", "选择 COV 目录"},
    {"OpenCppCoverage was not found in PATH. Install it from GitHub and add it to PATH.",
     "未在 PATH 中找到 OpenCppCoverage。请从 GitHub 安装并将其加入 PATH。"},
    {"OpenCppCoverage executable does not exist: %1", "OpenCppCoverage 可执行文件不存在：%1"},
    {"Target executable does not exist: %1", "目标程序不存在：%1"},
    {"Source directory does not exist: %1", "源码目录不存在：%1"},
    {"Output directory is empty.", "输出目录为空。"},
    {"Cannot create output directory: %1", "无法创建输出目录：%1"},
    {"COV directory does not exist: %1", "COV 目录不存在：%1"},
    {"A process is already running.", "已有进程正在运行。"},
    {"Error: %1", "错误：%1"},
    {"Starting coverage: %1", "开始运行覆盖率：%1"},
    {"Error: no .cov files found in %1", "错误：%1 中未找到 .cov 文件"},
    {"Error: cannot create merge output directory: %1", "错误：无法创建合并输出目录：%1"},
    {"Merging %1 coverage files.", "正在合并 %1 个覆盖率文件。"},
    {"Starting merge: %1", "开始合并：%1"},
    {"Settings saved.", "设置已保存。"},
    {"Settings loaded.", "设置已加载。"},
    {"Coverage completed. Output: %1", "覆盖率运行完成。输出目录：%1"},
    {"Merge completed. Output: %1", "合并完成。输出目录：%1"},
    {"Process finished with exit code %1.", "进程已结束，退出码：%1。"},
    {"Process error: %1", "进程错误：%1"},
};

QString defaultOutputDirectory()
{
    const QString documents = QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation);
    const QString base = documents.isEmpty() ? QDir::homePath() : documents;
    return QDir(base).filePath(QStringLiteral("CoverageTool/output"));
}

QString timestamp()
{
    return QDateTime::currentDateTime().toString(QStringLiteral("yyyy-MM-dd hh:mm:ss"));
}

QStringList splitCommandLine(const QString &commandLine)
{
    QStringList result;
    QString current;
    bool inQuotes = false;

    for (int i = 0; i < commandLine.size(); ++i)
    {
        const QChar ch = commandLine.at(i);
        if (ch == QLatin1Char('"'))
        {
            inQuotes = !inQuotes;
            continue;
        }

        if (ch.isSpace() && !inQuotes)
        {
            if (!current.isEmpty())
            {
                result << current;
                current.clear();
            }
            continue;
        }

        current.append(ch);
    }

    if (!current.isEmpty())
        result << current;

    return result;
}
} /* namespace */

CoverageTool::CoverageTool(QWidget *parent) : QMainWindow(parent)
{
    QCoreApplication::setOrganizationName(kOrganizationName);
    QCoreApplication::setApplicationName(kApplicationName);
    currentLanguage_ =
        QLocale::system().language() == QLocale::Chinese ? Language::Chinese : Language::English;
    detectedCoverageProgram_ = detectCoverageProgram();

    buildUi();
    loadSettings();

    connect(&process_, &QProcess::readyReadStandardOutput, this, &CoverageTool::readProcessOutput);
    connect(&process_, &QProcess::readyReadStandardError, this, &CoverageTool::readProcessOutput);
    connect(&process_, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this,
            &CoverageTool::onProcessFinished);
    connect(&process_, &QProcess::errorOccurred, this, &CoverageTool::onProcessError);

    appendLog(uiText("Ready. Configure OpenCppCoverage and target paths, then start coverage."));
}

void CoverageTool::buildUi()
{
    auto *central = new QWidget(this);
    auto *rootLayout = new QVBoxLayout(central);
    rootLayout->setContentsMargins(16, 16, 16, 16);
    rootLayout->setSpacing(12);

    auto *headerLayout = new QHBoxLayout();
    titleLabel_ = new QLabel(central);
    QFont titleFont = titleLabel_->font();
    titleFont.setPointSize(16);
    titleFont.setBold(true);
    titleLabel_->setFont(titleFont);
    languageLabel_ = new QLabel(central);
    languageCombo_ = new QComboBox(central);
    languageCombo_->setMinimumWidth(132);
    headerLayout->addWidget(titleLabel_);
    headerLayout->addStretch();
    headerLayout->addWidget(languageLabel_);
    headerLayout->addWidget(languageCombo_);
    rootLayout->addLayout(headerLayout);

    settingsGroup_ = new QGroupBox(central);
    settingsForm_ = new QFormLayout(settingsGroup_);
    settingsForm_->setFieldGrowthPolicy(QFormLayout::ExpandingFieldsGrow);

    targetExeEdit_ = new QLineEdit(settingsGroup_);
    sourceDirectoryEdit_ = new QLineEdit(settingsGroup_);
    pdbSourcePathEdit_ = new QLineEdit(settingsGroup_);
    outputDirectoryEdit_ = new QLineEdit(settingsGroup_);

    coverageStatusRow_ = createCoverageStatusRow();
    targetBrowseButton_ = new QPushButton(settingsGroup_);
    sourceBrowseButton_ = new QPushButton(settingsGroup_);
    pdbBrowseButton_ = new QPushButton(settingsGroup_);
    outputBrowseButton_ = new QPushButton(settingsGroup_);

    targetExeRow_ = createTargetRow(targetExeEdit_, targetBrowseButton_);
    sourceDirectoryRow_ = createPathRow(sourceDirectoryEdit_, sourceBrowseButton_);
    pdbSourcePathRow_ = createPathRow(pdbSourcePathEdit_, pdbBrowseButton_);
    outputDirectoryRow_ = createPathRow(outputDirectoryEdit_, outputBrowseButton_);

    settingsForm_->addRow(QString(), coverageStatusRow_);
    settingsForm_->addRow(QString(), targetExeRow_);
    settingsForm_->addRow(QString(), sourceDirectoryRow_);
    settingsForm_->addRow(QString(), pdbSourcePathRow_);
    settingsForm_->addRow(QString(), outputDirectoryRow_);

    excludedSourcesEdit_ = new QTextEdit(settingsGroup_);
    excludedSourcesEdit_->setAcceptRichText(false);
    excludedSourcesEdit_->setFixedHeight(72);
    settingsForm_->addRow(QString(), excludedSourcesEdit_);

    extraArgumentsEdit_ = new QTextEdit(settingsGroup_);
    extraArgumentsEdit_->setAcceptRichText(false);
    extraArgumentsEdit_->setFixedHeight(52);
    settingsForm_->addRow(QString(), extraArgumentsEdit_);

    coverChildrenCheck_ = new QCheckBox(settingsGroup_);
    optimizedBuildCheck_ = new QCheckBox(settingsGroup_);
    coverChildrenCheck_->setChecked(true);
    optimizedBuildCheck_->setChecked(true);
    optionsRow_ = new QWidget(settingsGroup_);
    auto *optionsLayout = new QHBoxLayout(optionsRow_);
    optionsLayout->setContentsMargins(0, 0, 0, 0);
    optionsLayout->addWidget(coverChildrenCheck_);
    optionsLayout->addWidget(optimizedBuildCheck_);
    optionsLayout->addStretch();
    settingsForm_->addRow(QString(), optionsRow_);

    rootLayout->addWidget(settingsGroup_);

    auto *actionsLayout = new QHBoxLayout();
    runCoverageButton_ = new QPushButton(central);
    openOutputButton_ = new QPushButton(central);
    saveSettingsButton_ = new QPushButton(central);
    reloadSettingsButton_ = new QPushButton(central);
    actionsLayout->addWidget(runCoverageButton_);
    actionsLayout->addWidget(openOutputButton_);
    actionsLayout->addStretch();
    actionsLayout->addWidget(saveSettingsButton_);
    actionsLayout->addWidget(reloadSettingsButton_);
    rootLayout->addLayout(actionsLayout);

    mergeGroup_ = new QGroupBox(central);
    mergeForm_ = new QFormLayout(mergeGroup_);
    mergeDirectoryEdit_ = new QLineEdit(mergeGroup_);
    mergeBrowseButton_ = new QPushButton(mergeGroup_);
    mergeDirectoryRow_ = createPathRow(mergeDirectoryEdit_, mergeBrowseButton_);
    mergeForm_->addRow(QString(), mergeDirectoryRow_);
    auto *mergeButtons = new QHBoxLayout();
    runMergeButton_ = new QPushButton(mergeGroup_);
    openMergeButton_ = new QPushButton(mergeGroup_);
    mergeButtons->addWidget(runMergeButton_);
    mergeButtons->addWidget(openMergeButton_);
    mergeButtons->addStretch();
    mergeForm_->addRow(QString(), mergeButtons);
    rootLayout->addWidget(mergeGroup_);

    logGroup_ = new QGroupBox(central);
    auto *logLayout = new QVBoxLayout(logGroup_);
    logOutput_ = new QPlainTextEdit(logGroup_);
    logOutput_->setReadOnly(true);
    logOutput_->setMinimumHeight(170);
    clearLogButton_ = new QPushButton(logGroup_);
    logLayout->addWidget(logOutput_);
    logLayout->addWidget(clearLogButton_, 0, Qt::AlignRight);
    rootLayout->addWidget(logGroup_, 1);

    setCentralWidget(central);
    resize(980, 760);

    connect(languageCombo_, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &CoverageTool::onLanguageChanged);
    connect(refreshCoverageButton_, &QPushButton::clicked, this,
            &CoverageTool::refreshCoverageStatus);
    connect(downloadCoverageButton_, &QPushButton::clicked, this,
            &CoverageTool::openCoverageDownloadPage);
    connect(targetBrowseButton_, &QPushButton::clicked, this, &CoverageTool::browseTargetExe);
    connect(targetExeEdit_, &QLineEdit::textChanged, this,
            &CoverageTool::updateWorkingDirectoryPreview);
    connect(sourceBrowseButton_, &QPushButton::clicked, this, &CoverageTool::browseSourceDirectory);
    connect(pdbBrowseButton_, &QPushButton::clicked, this, &CoverageTool::browsePdbSourcePath);
    connect(outputBrowseButton_, &QPushButton::clicked, this, &CoverageTool::browseOutputDirectory);
    connect(mergeBrowseButton_, &QPushButton::clicked, this, &CoverageTool::browseMergeDirectory);
    connect(runCoverageButton_, &QPushButton::clicked, this, &CoverageTool::runCoverage);
    connect(runMergeButton_, &QPushButton::clicked, this, &CoverageTool::runMerge);
    connect(openOutputButton_, &QPushButton::clicked, this, &CoverageTool::openOutputDirectory);
    connect(openMergeButton_, &QPushButton::clicked, this, &CoverageTool::openMergeDirectory);
    connect(saveSettingsButton_, &QPushButton::clicked, this, &CoverageTool::saveSettings);
    connect(reloadSettingsButton_, &QPushButton::clicked, this, &CoverageTool::loadSettings);
    connect(clearLogButton_, &QPushButton::clicked, this, &CoverageTool::clearLog);

    retranslateUi();
}

QWidget *CoverageTool::createPathRow(QLineEdit *lineEdit, QPushButton *button)
{
    auto *row = new QWidget(this);
    auto *layout = new QHBoxLayout(row);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->addWidget(lineEdit, 1);
    layout->addWidget(button);
    return row;
}

QWidget *CoverageTool::createCoverageStatusRow()
{
    auto *row = new QWidget(this);
    auto *layout = new QHBoxLayout(row);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(8);

    coverageStatusIcon_ = new QLabel(row);
    coverageStatusIcon_->setMinimumWidth(22);
    coverageStatusLabel_ = new QLabel(row);
    coverageStatusLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);
    refreshCoverageButton_ = new QPushButton(row);
    downloadCoverageButton_ = new QPushButton(row);
    downloadCoverageButton_->setIcon(style()->standardIcon(QStyle::SP_DialogOpenButton));

    layout->addWidget(coverageStatusIcon_);
    layout->addWidget(coverageStatusLabel_, 1);
    layout->addWidget(refreshCoverageButton_);
    layout->addWidget(downloadCoverageButton_);
    return row;
}

QWidget *CoverageTool::createTargetRow(QLineEdit *lineEdit, QPushButton *button)
{
    auto *row = new QWidget(this);
    auto *layout = new QVBoxLayout(row);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(4);

    auto *pathLayout = new QHBoxLayout();
    pathLayout->setContentsMargins(0, 0, 0, 0);
    pathLayout->addWidget(lineEdit, 1);
    pathLayout->addWidget(button);

    workingDirectoryPreviewLabel_ = new QLabel(row);
    workingDirectoryPreviewLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);
    workingDirectoryPreviewLabel_->setStyleSheet(QStringLiteral("color: #666;"));

    layout->addLayout(pathLayout);
    layout->addWidget(workingDirectoryPreviewLabel_);
    return row;
}

void CoverageTool::retranslateUi()
{
    setWindowTitle(uiText("CoverageTool"));
    titleLabel_->setText(uiText("CoverageTool"));
    languageLabel_->setText(uiText("Language"));

    {
        const QSignalBlocker blocker(languageCombo_);
        languageCombo_->clear();
        languageCombo_->addItem(uiText("English"), languageToSettings(Language::English));
        languageCombo_->addItem(uiText("Chinese"), languageToSettings(Language::Chinese));
        languageCombo_->setCurrentIndex(currentLanguage_ == Language::Chinese ? 1 : 0);
    }

    settingsGroup_->setTitle(uiText("Coverage settings"));
    targetExeEdit_->setPlaceholderText(uiText("Application executable to run under coverage"));
    sourceDirectoryEdit_->setPlaceholderText(
        uiText("Source root used by OpenCppCoverage --sources"));
    pdbSourcePathEdit_->setPlaceholderText(
        uiText("Optional original PDB source path prefix for --substitute_pdb_source_path"));
    outputDirectoryEdit_->setPlaceholderText(
        uiText("Directory for HTML, COV and Cobertura XML output"));

    refreshCoverageButton_->setText(uiText("Refresh"));
    downloadCoverageButton_->setText(uiText("Download"));
    targetBrowseButton_->setText(uiText("Browse..."));
    sourceBrowseButton_->setText(uiText("Browse..."));
    pdbBrowseButton_->setText(uiText("Browse..."));
    outputBrowseButton_->setText(uiText("Browse..."));

    setFormLabel(settingsForm_, coverageStatusRow_, uiText("OpenCppCoverage status"));
    setFormLabel(settingsForm_, targetExeRow_, uiText("Target executable"));
    setFormLabel(settingsForm_, sourceDirectoryRow_, uiText("Source directory"));
    setFormLabel(settingsForm_, pdbSourcePathRow_, uiText("PDB source path"));
    setFormLabel(settingsForm_, outputDirectoryRow_, uiText("Output directory"));

    excludedSourcesEdit_->setPlaceholderText(uiText("One excluded source path per line"));
    extraArgumentsEdit_->setPlaceholderText(uiText("Optional extra OpenCppCoverage arguments"));
    setFormLabel(settingsForm_, excludedSourcesEdit_, uiText("Excluded sources"));
    setFormLabel(settingsForm_, extraArgumentsEdit_, uiText("Extra arguments"));

    coverChildrenCheck_->setText(uiText("Cover child processes"));
    optimizedBuildCheck_->setText(uiText("Use optimized build mode"));
    setFormLabel(settingsForm_, optionsRow_, uiText("Options"));

    runCoverageButton_->setText(uiText("Run coverage"));
    openOutputButton_->setText(uiText("Open output"));
    saveSettingsButton_->setText(uiText("Save settings"));
    reloadSettingsButton_->setText(uiText("Reload settings"));

    mergeGroup_->setTitle(uiText("Merge coverage files"));
    mergeDirectoryEdit_->setPlaceholderText(uiText("Directory containing .cov files"));
    mergeBrowseButton_->setText(uiText("Browse..."));
    setFormLabel(mergeForm_, mergeDirectoryRow_, uiText("COV directory"));
    runMergeButton_->setText(uiText("Merge COV files"));
    openMergeButton_->setText(uiText("Open merge output"));

    logGroup_->setTitle(uiText("Log"));
    clearLogButton_->setText(uiText("Clear log"));

    refreshCoverageStatus();
    updateWorkingDirectoryPreview();
}

void CoverageTool::setFormLabel(QFormLayout *form, QWidget *field, const QString &text)
{
    if (auto *label = qobject_cast<QLabel *>(form->labelForField(field)))
        label->setText(text);
}

void CoverageTool::setLanguage(Language language, bool persist)
{
    if (currentLanguage_ == language)
    {
        retranslateUi();
        return;
    }

    currentLanguage_ = language;
    retranslateUi();

    if (persist)
        saveLanguageSetting();
}

void CoverageTool::saveLanguageSetting()
{
    QSettings settings;
    settings.setValue(QLatin1String(kSettingsLanguage), languageToSettings(currentLanguage_));
    settings.sync();
}

QString CoverageTool::uiText(const char *sourceText) const
{
    if (currentLanguage_ != Language::Chinese)
        return QString::fromUtf8(sourceText);

    for (const Translation &translation : kTranslations)
    {
        if (QLatin1String(translation.source) == QLatin1String(sourceText))
            return QString::fromUtf8(translation.chinese);
    }

    return QString::fromUtf8(sourceText);
}

CoverageTool::Language CoverageTool::languageFromSettings(const QString &value) const
{
    if (value.compare(QLatin1String(kLanguageChinese), Qt::CaseInsensitive) == 0)
        return Language::Chinese;
    if (value.compare(QLatin1String(kLanguageEnglish), Qt::CaseInsensitive) == 0)
        return Language::English;
    return QLocale::system().language() == QLocale::Chinese ? Language::Chinese : Language::English;
}

QString CoverageTool::languageToSettings(Language language) const
{
    return language == Language::Chinese ? QString::fromLatin1(kLanguageChinese)
                                         : QString::fromLatin1(kLanguageEnglish);
}

void CoverageTool::onLanguageChanged(int index)
{
    const QString value = languageCombo_->itemData(index).toString();
    setLanguage(languageFromSettings(value), true);
}

void CoverageTool::refreshCoverageStatus()
{
    detectedCoverageProgram_ = detectCoverageProgram();
    const bool found = !detectedCoverageProgram_.isEmpty();
    coverageStatusIcon_->setText(found ? QString::fromUtf8("✅") : QString::fromUtf8("⚠"));
    coverageStatusLabel_->setText(
        found ? uiText("Found in PATH: %1").arg(detectedCoverageProgram_)
              : uiText("Not found in PATH. Install OpenCppCoverage and add it to PATH."));
    downloadCoverageButton_->setVisible(!found);
}

void CoverageTool::openCoverageDownloadPage()
{
    QDesktopServices::openUrl(QUrl(QString::fromLatin1(kOpenCppCoverageUrl)));
}

void CoverageTool::updateWorkingDirectoryPreview()
{
    const QString workDir = workingDirectory();
    if (workDir.isEmpty() || targetExeEdit_->text().trimmed().isEmpty())
    {
        workingDirectoryPreviewLabel_->setText(
            uiText("Select an application to infer the working directory."));
        return;
    }

    workingDirectoryPreviewLabel_->setText(uiText("Working directory: %1").arg(workDir));
}

void CoverageTool::browseTargetExe()
{
    const QString path = QFileDialog::getOpenFileName(this, uiText("Select target executable"),
                                                      QString(), uiText("Executable (*.exe)"));
    if (!path.isEmpty())
        targetExeEdit_->setText(QDir::toNativeSeparators(path));
}

void CoverageTool::browseSourceDirectory()
{
    const QString path = QFileDialog::getExistingDirectory(this, uiText("Select source directory"));
    if (!path.isEmpty())
        sourceDirectoryEdit_->setText(QDir::toNativeSeparators(path));
}

void CoverageTool::browsePdbSourcePath()
{
    const QString path = QFileDialog::getExistingDirectory(this, uiText("Select PDB source path"));
    if (!path.isEmpty())
        pdbSourcePathEdit_->setText(QDir::toNativeSeparators(path));
}

void CoverageTool::browseOutputDirectory()
{
    const QString path = QFileDialog::getExistingDirectory(this, uiText("Select output directory"));
    if (!path.isEmpty())
        outputDirectoryEdit_->setText(QDir::toNativeSeparators(path));
}

void CoverageTool::browseMergeDirectory()
{
    const QString path = QFileDialog::getExistingDirectory(this, uiText("Select COV directory"));
    if (!path.isEmpty())
        mergeDirectoryEdit_->setText(QDir::toNativeSeparators(path));
}

bool CoverageTool::validateCoverageInputs(QString *errorMessage) const
{
    const QString program = coverageProgram();
    if (program.isEmpty())
    {
        *errorMessage = uiText(
            "OpenCppCoverage was not found in PATH. Install it from GitHub and add it to PATH.");
        return false;
    }

    if (!QFileInfo(program).isFile())
    {
        *errorMessage = uiText("OpenCppCoverage executable does not exist: %1").arg(program);
        return false;
    }

    const QString targetExe = normalizedPath(targetExeEdit_->text());
    if (!QFileInfo(targetExe).isFile())
    {
        *errorMessage = uiText("Target executable does not exist: %1").arg(targetExe);
        return false;
    }

    const QString sourceDir = normalizedPath(sourceDirectoryEdit_->text());
    if (!QFileInfo(sourceDir).isDir())
    {
        *errorMessage = uiText("Source directory does not exist: %1").arg(sourceDir);
        return false;
    }

    const QString outDir = outputDirectory();
    if (outDir.isEmpty())
    {
        *errorMessage = uiText("Output directory is empty.");
        return false;
    }

    if (!QDir().mkpath(outDir))
    {
        *errorMessage = uiText("Cannot create output directory: %1").arg(outDir);
        return false;
    }

    return true;
}

bool CoverageTool::validateMergeInputs(QString *errorMessage) const
{
    const QString program = coverageProgram();
    if (program.isEmpty())
    {
        *errorMessage = uiText(
            "OpenCppCoverage was not found in PATH. Install it from GitHub and add it to PATH.");
        return false;
    }

    const QString covDir = normalizedPath(mergeDirectoryEdit_->text());
    if (!QFileInfo(covDir).isDir())
    {
        *errorMessage = uiText("COV directory does not exist: %1").arg(covDir);
        return false;
    }

    const QString outDir = outputDirectory();
    if (outDir.isEmpty() || !QDir().mkpath(outDir))
    {
        *errorMessage = uiText("Cannot create output directory: %1").arg(outDir);
        return false;
    }

    return true;
}

QStringList CoverageTool::buildCoverageArguments() const
{
    const QString targetExe = normalizedPath(targetExeEdit_->text());
    const QString sourceDir = normalizedPath(sourceDirectoryEdit_->text());
    const QString outDir = outputDirectory();
    const QString htmlDir = QDir(outDir).filePath(QStringLiteral("html"));
    const QString covFile = QDir(outDir).filePath(QStringLiteral("coverage.cov"));
    const QString xmlFile = QDir(outDir).filePath(QStringLiteral("coverage.xml"));

    QStringList args;
    args << QStringLiteral("--modules") << QFileInfo(targetExe).fileName();
    args << QStringLiteral("--sources") << sourceDir;

    const QString pdbSourcePath = normalizedPath(pdbSourcePathEdit_->text());
    if (!pdbSourcePath.isEmpty())
    {
        args << QStringLiteral("--substitute_pdb_source_path")
             << QStringLiteral("%1?%2").arg(pdbSourcePath, sourceDir);
    }

    for (const QString &path : excludedSourcePaths())
        args << QStringLiteral("--excluded_sources") << path;

    args << QStringLiteral("--export_type=html:%1").arg(htmlDir);
    args << QStringLiteral("--export_type=binary:%1").arg(covFile);
    args << QStringLiteral("--export_type=cobertura:%1").arg(xmlFile);
    args << QStringLiteral("--verbose");

    if (optimizedBuildCheck_->isChecked())
        args << QStringLiteral("--optimized_build");
    if (coverChildrenCheck_->isChecked())
        args << QStringLiteral("--cover_children");

    const QString extra = extraArgumentsEdit_->toPlainText().trimmed();
    if (!extra.isEmpty())
        args << splitCommandLine(extra);

    args << QStringLiteral("--") << targetExe;
    return args;
}

QStringList CoverageTool::buildMergeArguments(const QStringList &coverageFiles,
                                              const QString &mergeDir) const
{
    QStringList args;
    for (const QString &file : coverageFiles)
        args << QStringLiteral("--input_coverage=%1").arg(file);

    args << QStringLiteral("--export_type=html:%1").arg(mergeDir);
    args << QStringLiteral("--export_type=binary:%1").arg(QDir(mergeDir).filePath("merged.cov"));
    args << QStringLiteral("--export_type=cobertura:%1").arg(QDir(mergeDir).filePath("merged.xml"));
    return args;
}

QStringList CoverageTool::excludedSourcePaths() const
{
    QStringList result;
    const QStringList lines = excludedSourcesEdit_->toPlainText().split('\n');
    for (const QString &line : lines)
    {
        const QString path = normalizedPath(line);
        if (!path.isEmpty())
            result << path;
    }
    result.removeDuplicates();
    return result;
}

QStringList CoverageTool::findCoverageFiles(const QString &directory) const
{
    QStringList files;
    QDirIterator it(directory, QStringList() << QStringLiteral("*.cov"), QDir::Files,
                    QDirIterator::Subdirectories);
    while (it.hasNext())
        files << QDir::toNativeSeparators(it.next());
    files.sort();
    return files;
}

void CoverageTool::runCoverage()
{
    refreshCoverageStatus();

    if (process_.state() != QProcess::NotRunning)
    {
        appendLog(uiText("A process is already running."));
        return;
    }

    QString errorMessage;
    if (!validateCoverageInputs(&errorMessage))
    {
        appendLog(uiText("Error: %1").arg(errorMessage));
        return;
    }

    saveSettings();

    const QString outDir = outputDirectory();
    QDir().mkpath(QDir(outDir).filePath(QStringLiteral("html")));
    lastOutputDirectory_ = outDir;

    const QString program = coverageProgram();
    const QStringList args = buildCoverageArguments();
    const QString workDir = workingDirectory();
    if (!workDir.isEmpty())
        process_.setWorkingDirectory(workDir);

    runMode_ = RunMode::Coverage;
    setRunning(true);
    appendLog(uiText("Starting coverage: %1").arg(commandPreview(program, args)));
    process_.start(program, args);
}

void CoverageTool::runMerge()
{
    refreshCoverageStatus();

    if (process_.state() != QProcess::NotRunning)
    {
        appendLog(uiText("A process is already running."));
        return;
    }

    QString errorMessage;
    if (!validateMergeInputs(&errorMessage))
    {
        appendLog(uiText("Error: %1").arg(errorMessage));
        return;
    }

    saveSettings();

    const QString covDir = normalizedPath(mergeDirectoryEdit_->text());
    const QStringList covFiles = findCoverageFiles(covDir);
    if (covFiles.isEmpty())
    {
        appendLog(uiText("Error: no .cov files found in %1").arg(covDir));
        return;
    }

    const QString mergeDir =
        QDir(outputDirectory())
            .filePath(
                QStringLiteral("merge/%1").arg(QDateTime::currentDateTime().toSecsSinceEpoch()));
    if (!QDir().mkpath(mergeDir))
    {
        appendLog(uiText("Error: cannot create merge output directory: %1").arg(mergeDir));
        return;
    }

    lastMergeDirectory_ = mergeDir;
    const QString program = coverageProgram();
    const QStringList args = buildMergeArguments(covFiles, mergeDir);

    runMode_ = RunMode::Merge;
    setRunning(true);
    appendLog(uiText("Merging %1 coverage files.").arg(covFiles.size()));
    appendLog(uiText("Starting merge: %1").arg(commandPreview(program, args)));
    process_.start(program, args);
}

void CoverageTool::openOutputDirectory()
{
    const QString dir = lastOutputDirectory_.isEmpty() ? outputDirectory() : lastOutputDirectory_;
    if (!dir.isEmpty())
        QDesktopServices::openUrl(QUrl::fromLocalFile(dir));
}

void CoverageTool::openMergeDirectory()
{
    const QString dir = lastMergeDirectory_.isEmpty()
                            ? QDir(outputDirectory()).filePath(QStringLiteral("merge"))
                            : lastMergeDirectory_;
    if (!dir.isEmpty())
        QDesktopServices::openUrl(QUrl::fromLocalFile(dir));
}

void CoverageTool::saveSettings()
{
    QSettings settings;
    settings.setValue(QLatin1String(kSettingsLanguage), languageToSettings(currentLanguage_));
    settings.setValue(QStringLiteral("TargetExecutable"), targetExeEdit_->text().trimmed());
    settings.setValue(QStringLiteral("SourceDirectory"), sourceDirectoryEdit_->text().trimmed());
    settings.setValue(QStringLiteral("PdbSourcePath"), pdbSourcePathEdit_->text().trimmed());
    settings.setValue(QStringLiteral("OutputDirectory"), outputDirectoryEdit_->text().trimmed());
    settings.setValue(QStringLiteral("MergeDirectory"), mergeDirectoryEdit_->text().trimmed());
    settings.setValue(QStringLiteral("ExcludedSources"), excludedSourcesEdit_->toPlainText());
    settings.setValue(QStringLiteral("ExtraArguments"), extraArgumentsEdit_->toPlainText());
    settings.setValue(QStringLiteral("CoverChildren"), coverChildrenCheck_->isChecked());
    settings.setValue(QStringLiteral("OptimizedBuild"), optimizedBuildCheck_->isChecked());
    settings.sync();
    appendLog(uiText("Settings saved."));
}

void CoverageTool::loadSettings()
{
    QSettings settings;
    setLanguage(languageFromSettings(settings.value(QLatin1String(kSettingsLanguage)).toString()),
                false);
    targetExeEdit_->setText(settings.value(QStringLiteral("TargetExecutable")).toString());
    sourceDirectoryEdit_->setText(settings.value(QStringLiteral("SourceDirectory")).toString());
    pdbSourcePathEdit_->setText(settings.value(QStringLiteral("PdbSourcePath")).toString());
    outputDirectoryEdit_->setText(
        settings.value(QStringLiteral("OutputDirectory"), defaultOutputDirectory()).toString());
    mergeDirectoryEdit_->setText(settings.value(QStringLiteral("MergeDirectory")).toString());
    excludedSourcesEdit_->setPlainText(
        settings.value(QStringLiteral("ExcludedSources")).toString());
    extraArgumentsEdit_->setPlainText(settings.value(QStringLiteral("ExtraArguments")).toString());
    coverChildrenCheck_->setChecked(settings.value(QStringLiteral("CoverChildren"), true).toBool());
    optimizedBuildCheck_->setChecked(
        settings.value(QStringLiteral("OptimizedBuild"), true).toBool());
    refreshCoverageStatus();
    updateWorkingDirectoryPreview();
    appendLog(uiText("Settings loaded."));
}

void CoverageTool::clearLog()
{
    logOutput_->clear();
}

void CoverageTool::readProcessOutput()
{
    const QByteArray stdoutData = process_.readAllStandardOutput();
    if (!stdoutData.isEmpty())
        appendLog(QString::fromLocal8Bit(stdoutData).trimmed());

    const QByteArray stderrData = process_.readAllStandardError();
    if (!stderrData.isEmpty())
        appendLog(QString::fromLocal8Bit(stderrData).trimmed());
}

void CoverageTool::onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    readProcessOutput();
    setRunning(false);

    if (exitStatus == QProcess::NormalExit && exitCode == 0)
    {
        if (runMode_ == RunMode::Coverage)
            appendLog(uiText("Coverage completed. Output: %1").arg(lastOutputDirectory_));
        else if (runMode_ == RunMode::Merge)
            appendLog(uiText("Merge completed. Output: %1").arg(lastMergeDirectory_));
    }
    else
    {
        appendLog(uiText("Process finished with exit code %1.").arg(exitCode));
    }

    runMode_ = RunMode::None;
}

void CoverageTool::onProcessError(QProcess::ProcessError error)
{
    Q_UNUSED(error);
    appendLog(uiText("Process error: %1").arg(process_.errorString()));
    setRunning(false);
    runMode_ = RunMode::None;
}

QString CoverageTool::detectCoverageProgram() const
{
    return QDir::toNativeSeparators(
        QStandardPaths::findExecutable(QString::fromLatin1(kDefaultCoverageExe)));
}

QString CoverageTool::coverageProgram() const
{
    return detectedCoverageProgram_;
}

QString CoverageTool::outputDirectory() const
{
    const QString path = normalizedPath(outputDirectoryEdit_->text());
    return path.isEmpty() ? QDir::toNativeSeparators(defaultOutputDirectory()) : path;
}

QString CoverageTool::workingDirectory() const
{
    const QString targetExe = normalizedPath(targetExeEdit_->text());
    if (targetExe.isEmpty())
        return {};
    return QFileInfo(targetExe).absolutePath();
}

QString CoverageTool::normalizedPath(const QString &path) const
{
    const QString trimmed = path.trimmed();
    if (trimmed.isEmpty())
        return {};
    return QDir::toNativeSeparators(QDir::cleanPath(QDir::fromNativeSeparators(trimmed)));
}

QString CoverageTool::commandPreview(const QString &program, const QStringList &arguments) const
{
    QStringList parts;
    QString shownProgram = program;
    if (shownProgram.contains(' '))
        shownProgram = QStringLiteral("\"%1\"").arg(shownProgram);
    parts << shownProgram;

    for (const QString &arg : arguments)
    {
        QString value = arg;
        if (value.contains(' '))
            value = QStringLiteral("\"%1\"").arg(value);
        parts << value;
    }
    return parts.join(' ');
}

void CoverageTool::appendLog(const QString &message)
{
    if (message.isEmpty())
        return;

    const QStringList lines = message.split('\n');
    for (const QString &line : lines)
    {
        if (!line.trimmed().isEmpty())
            logOutput_->appendPlainText(QStringLiteral("[%1] %2").arg(timestamp(), line.trimmed()));
    }
}

void CoverageTool::setRunning(bool running)
{
    runCoverageButton_->setEnabled(!running);
    runMergeButton_->setEnabled(!running);
}
