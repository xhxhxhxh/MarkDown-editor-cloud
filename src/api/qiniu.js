const qiniu = require('qiniu')
const path = require('path')
const axios = require('axios')
const fs = require('fs')

class QiniuAPI {
    constructor(accessKey, secretKey, bucket) {
        this.bucket = bucket
        this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
        this.config = new qiniu.conf.Config();
        // 空间对应的机房
        this.config.zone = qiniu.zone.Zone_z0;
        this.publicBucketDomain = '';
        this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    }
    createToken(fileName) {
        const putPolicy = new qiniu.rs.PutPolicy({scope: this.bucket + ':' + fileName});
        this.uploadToken = putPolicy.uploadToken(this.mac);
    }
    uploadFile(localFile) {
        const formUploader = new qiniu.form_up.FormUploader(this.config);
        const putExtra = new qiniu.form_up.PutExtra();
        const key= path.basename(localFile);
        this.createToken(key)
        // 文件上传
        return new Promise((resolve, reject) => {
            formUploader.putFile(this.uploadToken, key, localFile, putExtra, this._handleCallback(resolve, reject))
        })
    }

    // 获取文件信息
    getFileInfo(key) {
        return new Promise((resolve, reject) => {
            this.bucketManager.stat(this.bucket, key, this._handleCallback(resolve, reject))
        })
    }

    // 获取文件信息列表
    getFileInfoList() {
        const options = {
            limit: 100
        }
        return new Promise((resolve, reject) => {
            this.bucketManager.listPrefix(this.bucket, options, this._handleCallback(resolve, reject))
        })
    }

    // 删除文件
    deleteFile(key) {
        return new Promise((resolve, reject) => {
            this.bucketManager.delete(this.bucket, key, this._handleCallback(resolve, reject))
        })
    }

    // 重命名
    fileRename(srcKey, destKey) {
        const options = {
            force: true
        }
        return new Promise((resolve, reject) => {
            this.bucketManager.move(this.bucket, srcKey, this.bucket, destKey, options, this._handleCallback(resolve, reject))
        })
    }

    // 下载文件
    downloadFile(key, downloadPath) {
        return this.generateDownloadLink(key).then(link => {
            const timeStamp = new Date().getTime()
            return axios({
                url: link + '?timeStamp=' + timeStamp,
                method: 'GET',
                responseType: 'stream',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            }).then(res => {
                const writer = fs.createWriteStream(downloadPath)
                res.data.pipe(writer)
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve)
                    writer.on('error', reject)
                })
            })
        })
    }

    generateDownloadLink(key) {
        const domainPromise = this.publicBucketDomain ? 
            Promise.resolve([this.publicBucketDomain]) : this.getBucketDomain()
        return domainPromise.then(data => {
            if (Array.isArray(data) && data.length > 0) {
              const pattern = /^https?/
              this.publicBucketDomain = pattern.test(data[0]) ? data[0] : `http://${data[0]}`
              return this.bucketManager.publicDownloadUrl(this.publicBucketDomain, key)
            } else {
              throw Error('域名未找到，请查看存储空间是否已经过期')
            }
        })
    }
    getBucketDomain() {
        const reqURL = `http://api.qiniu.com/v6/domain/list?tbl=${this.bucket}`
        const digest = qiniu.util.generateAccessToken(this.mac, reqURL)
        return new Promise((resolve, reject) => {
          qiniu.rpc.postWithoutForm(reqURL, digest, this._handleCallback(resolve, reject))
        })
    }
    _handleCallback(resolve, reject) {
        return (respErr, respBody, respInfo) => {
            if (respErr) {
                throw respErr;
            }
            if (respInfo.statusCode === 200) {
                resolve(respBody);
            } else {
                reject({
                    statusCode: respInfo.statusCode,
                    body: respBody
                  })
            }
        }
           
    }
}
module.exports = QiniuAPI