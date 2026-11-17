# Đích WebAssembly riêng cho game (thêm vào cây sherpa-onnx bởi build.sh).
set(MY_FLAGS " -sFORCE_FILESYSTEM=1 -sINITIAL_MEMORY=64MB -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=2GB")
string(APPEND MY_FLAGS " -sSTACK_SIZE=5242880 ")
string(APPEND MY_FLAGS " -sMODULARIZE=1 -sEXPORT_NAME=createChoNoiAsr -sENVIRONMENT=web,worker,node ")
string(APPEND MY_FLAGS " -sEXPORTED_FUNCTIONS=[_malloc,_free,_cn_create,_cn_destroy,_cn_decode] ")
string(APPEND MY_FLAGS " -sEXPORTED_RUNTIME_METHODS=['FS','UTF8ToString','stringToUTF8','lengthBytesUTF8','HEAPF32','HEAPU8'] ")
set(CMAKE_EXECUTABLE_LINKER_FLAGS "${CMAKE_EXECUTABLE_LINKER_FLAGS} ${MY_FLAGS}")
include_directories(${CMAKE_SOURCE_DIR})
add_executable(chonoi-asr chonoi-asr.cc)
target_link_libraries(chonoi-asr sherpa-onnx-c-api)
set_target_properties(chonoi-asr PROPERTIES LINK_FLAGS "${MY_FLAGS}")
install(FILES
  "$<TARGET_FILE_DIR:chonoi-asr>/chonoi-asr.js"
  "$<TARGET_FILE_DIR:chonoi-asr>/chonoi-asr.wasm"
  DESTINATION bin/wasm/chonoi)
