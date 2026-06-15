cmake_minimum_required(VERSION 3.16)

cmake_policy(SET CMP0091 NEW)

project(CoverageTool VERSION 1.0.0 LANGUAGES CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC OFF)

find_package(Qt5 5.12 REQUIRED COMPONENTS Core Gui Widgets)

add_executable(CoverageTool WIN32
    CoverageTool/CoverageTool.cpp
    CoverageTool/CoverageTool.h
    CoverageTool/main.cpp
    CoverageTool/CoverageTool.qrc
    CoverageTool/CoverageResource.rc
)

target_link_libraries(CoverageTool PRIVATE
    Qt5::Core
    Qt5::Gui
    Qt5::Widgets
)

target_compile_definitions(CoverageTool PRIVATE
    NOMINMAX
    WIN32_LEAN_AND_MEAN
)

if(MSVC)
    target_compile_options(CoverageTool PRIVATE /utf-8)
    set_property(TARGET CoverageTool PROPERTY
        MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
endif()

set_target_properties(CoverageTool PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin/Debug"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin/Release"
    RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}/bin/RelWithDebInfo"
    RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}/bin/MinSizeRel"
)

option(COVERAGETOOL_RUN_WINDEPLOYQT "Run windeployqt after building CoverageTool." ON)

if(WIN32 AND COVERAGETOOL_RUN_WINDEPLOYQT)
    get_target_property(QT_QMAKE_EXECUTABLE Qt5::qmake IMPORTED_LOCATION)
    get_filename_component(QT_BIN_DIR "${QT_QMAKE_EXECUTABLE}" DIRECTORY)
    find_program(WINDEPLOYQT_EXECUTABLE windeployqt HINTS "${QT_BIN_DIR}" REQUIRED)

    add_custom_command(TARGET CoverageTool POST_BUILD
        COMMAND "${WINDEPLOYQT_EXECUTABLE}" --force --no-translations --no-compiler-runtime "$<TARGET_FILE:CoverageTool>"
        COMMENT "Deploying Qt runtime files"
        VERBATIM
    )
endif()
