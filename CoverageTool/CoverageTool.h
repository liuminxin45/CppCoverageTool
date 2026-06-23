#pragma once

#include <QMainWindow>
#include <QProcess>
#include <QString>
#include <QStringList>

class QCheckBox;
class QComboBox;
class QFormLayout;
class QGroupBox;
class QLabel;
class QLineEdit;
class QPlainTextEdit;
class QPushButton;
class QTextEdit;
class QWidget;

class CoverageTool : public QMainWindow
{
    Q_OBJECT

public:
    explicit CoverageTool(QWidget *parent = nullptr);
    ~CoverageTool() override = default;

private slots:
    void browseTargetExe();
    void browseSourceDirectory();
    void browsePdbSourcePath();
    void browseOutputDirectory();
    void browseMergeDirectory();
    void runCoverage();
    void runMerge();
    void openOutputDirectory();
    void openMergeDirectory();
    void saveSettings();
    void loadSettings();
    void clearLog();
    void readProcessOutput();
    void onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onProcessError(QProcess::ProcessError error);
    void onLanguageChanged(int index);
    void refreshCoverageStatus();
    void openCoverageDownloadPage();
    void updateWorkingDirectoryPreview();

private:
    enum class Language
    {
        English,
        Chinese,
    };

    enum class RunMode
    {
        None,
        Coverage,
        Merge,
    };

    void buildUi();
    void applyVisualStyle(QWidget *root);
    QLabel *createHelpLabel(QWidget *parent) const;
    QWidget *createPathRow(QLineEdit *lineEdit, QPushButton *button);
    QWidget *createCoverageStatusRow();
    QWidget *createTargetRow(QLineEdit *lineEdit, QPushButton *button);
    void retranslateUi();
    void setFormLabel(QFormLayout *form, QWidget *field, const QString &text);
    void setLanguage(Language language, bool persist);
    void saveLanguageSetting();
    QString uiText(const char *sourceText) const;
    Language languageFromSettings(const QString &value) const;
    QString languageToSettings(Language language) const;
    bool validateCoverageInputs(QString *errorMessage) const;
    bool validateMergeInputs(QString *errorMessage) const;
    QStringList buildCoverageArguments() const;
    QStringList buildMergeArguments(const QStringList &coverageFiles,
                                    const QString &mergeDir) const;
    QStringList excludedSourcePaths() const;
    QStringList findCoverageFiles(const QString &directory) const;
    QString detectCoverageProgram() const;
    QString coverageProgram() const;
    QString outputDirectory() const;
    QString workingDirectory() const;
    QString normalizedPath(const QString &path) const;
    QString commandPreview(const QString &program, const QStringList &arguments) const;
    void appendLog(const QString &message);
    void setRunning(bool running);

    QLabel *titleLabel_{nullptr};
    QLabel *subtitleLabel_{nullptr};
    QLabel *languageLabel_{nullptr};
    QComboBox *languageCombo_{nullptr};
    QGroupBox *settingsGroup_{nullptr};
    QGroupBox *rulesGroup_{nullptr};
    QGroupBox *mergeGroup_{nullptr};
    QGroupBox *logGroup_{nullptr};
    QFormLayout *settingsForm_{nullptr};
    QFormLayout *rulesForm_{nullptr};
    QFormLayout *mergeForm_{nullptr};
    QLabel *workflowHintLabel_{nullptr};
    QLabel *rulesHintLabel_{nullptr};
    QLabel *mergeHintLabel_{nullptr};
    QWidget *coverageStatusRow_{nullptr};
    QWidget *targetExeRow_{nullptr};
    QWidget *sourceDirectoryRow_{nullptr};
    QWidget *pdbSourcePathRow_{nullptr};
    QWidget *outputDirectoryRow_{nullptr};
    QWidget *optionsRow_{nullptr};
    QWidget *mergeDirectoryRow_{nullptr};
    QLabel *coverageStatusIcon_{nullptr};
    QLabel *coverageStatusLabel_{nullptr};
    QLabel *workingDirectoryPreviewLabel_{nullptr};
    QLineEdit *targetExeEdit_{nullptr};
    QLineEdit *sourceDirectoryEdit_{nullptr};
    QLineEdit *pdbSourcePathEdit_{nullptr};
    QLineEdit *outputDirectoryEdit_{nullptr};
    QLineEdit *mergeDirectoryEdit_{nullptr};
    QTextEdit *excludedSourcesEdit_{nullptr};
    QTextEdit *extraArgumentsEdit_{nullptr};
    QCheckBox *coverChildrenCheck_{nullptr};
    QCheckBox *optimizedBuildCheck_{nullptr};
    QPushButton *refreshCoverageButton_{nullptr};
    QPushButton *downloadCoverageButton_{nullptr};
    QPushButton *targetBrowseButton_{nullptr};
    QPushButton *sourceBrowseButton_{nullptr};
    QPushButton *pdbBrowseButton_{nullptr};
    QPushButton *outputBrowseButton_{nullptr};
    QPushButton *mergeBrowseButton_{nullptr};
    QPushButton *runCoverageButton_{nullptr};
    QPushButton *runMergeButton_{nullptr};
    QPushButton *openOutputButton_{nullptr};
    QPushButton *openMergeButton_{nullptr};
    QPushButton *saveSettingsButton_{nullptr};
    QPushButton *reloadSettingsButton_{nullptr};
    QPushButton *clearLogButton_{nullptr};
    QPlainTextEdit *logOutput_{nullptr};

    QProcess process_;
    QString detectedCoverageProgram_;
    Language currentLanguage_{Language::English};
    RunMode runMode_{RunMode::None};
    QString lastOutputDirectory_;
    QString lastMergeDirectory_;
};
