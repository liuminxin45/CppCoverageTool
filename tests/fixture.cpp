#include <windows.h>
#include <string>
#include <iostream>

int main(int argc, char** argv) {
    const std::string argument = argc > 1 ? argv[1] : "";
    if (argument == "sleep") {
        Sleep(30000);
    }
    if (argument == "alternate") {
        std::cout << "alternate branch\n";
    } else {
        std::cout << "default branch\n";
    }
    return 0;
}
