#include <QApplication>
#include <QFont>
#include <QIcon>
#include <QLocale>

#include "CoverageTool.h"

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);

    const bool isZh = QLocale::system().language() == QLocale::Chinese;
    const QString family = isZh ? QStringLiteral("Microsoft YaHei UI") : QStringLiteral("Segoe UI");

    QFont defaultFont(family);
    defaultFont.setPointSize(10);
    defaultFont.setStyleStrategy(QFont::PreferAntialias);
    QApplication::setFont(defaultFont);

    a.setWindowIcon(QIcon(":/Icon.png"));

    CoverageTool w;
    w.show();

    return a.exec();
}
