const fs = window.require('fs').promises

const fileHelper = {
    readFile: path => {
        return fs.readFile(path, {encoding: 'utf-8'})
    },
    writeFile: (path, content) => {
        return fs.writeFile(path, content, {encoding: 'utf-8'})
    },
    renameFile: (path, newPath) => {
        return fs.rename(path, newPath)
    },
    deleteFile: path => {
        return fs.unlink(path)
    },
    isFileExisted: (path) => {
        return fs.access(path)
    }
}

export default fileHelper

// const writeFilePath = path.join(__dirname, '新文件.txt')
// const content = 'hello world'
// const newFilePath = path.join(__dirname, '文件123.txt')
// fileHelper.writeFile(writeFilePath, content).then(() => {
//     console.log('新建文件成功');
// })
// fileHelper.readFile(writeFilePath).then((data) => {
//     console.log(data);
// })

// fileHelper.renameFile(writeFilePath, newFilePath).then(() => {
//     console.log('重命名成功');
// })

// fileHelper.deleteFile(newFilePath).then(() => {
//     console.log(`删除${newFilePath}成功`);
// })