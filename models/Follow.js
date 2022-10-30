
const usersCollection = require('../db').db().collection("users")
const followCollection = require('../db').db().collection("follow")
const ObjectID = require('mongodb').ObjectId
const User = require('./User')

let Follow = function(followedUsername, authorId){
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = async function(){
    if(typeof(this.followedUsername) != "string"){
        this.followedUsername = ""
    }
}

Follow.prototype.validate = async function(action){
    // check if the followedUsername exists or not

    let followedAccount = await usersCollection.findOne({username: this.followedUsername})
    if(followedAccount){
        this.followedId = followedAccount._id
    }else{
        this.errors.push("You cannot follow a user that does not exist.")
    }

    let doesFollowAlreadyExist = await followCollection.findOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})

    if(action == "create"){
        if(doesFollowAlreadyExist){
            this.errors.push("You are already following this user!!!")
        }
    }
    if(action == "delete"){
        if(!doesFollowAlreadyExist){
            this.errors.push("You can not stop following a user, you never followed!!!")
        }
    }

    // self follow disabled

    if(this.followedId == this.authorId){
        this.errors.push("You can not follow yourself.")
    }



}


Follow.prototype.create = function(){
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("create")

        if(!this.errors.length){

            await followCollection.insertOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()

        }else{
            reject(this.errors)
        }

    })
}

Follow.prototype.delete = function(){
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("delete")
        if(!this.errors.length){
            
            await followCollection.deleteOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()

        }else{
            reject(this.errors)
        }

    })
}


Follow.isVisitorFollowing = async function(followedId, visitorId){

    let followDoc = await followCollection.findOne({followedId: followedId, authorId: new ObjectID(visitorId)})
    if(followDoc){
        return true
    }else{
        return false
    }

}


Follow.getFollowersById = function(id){
    return new Promise(async (resolve, reject) => {
        try{
            let followers = await followCollection.aggregate([
                {$match: {followedId: id}},
                {$lookup : {from: "users", localField: "authorId", foreignField:"_id", as: "userDoc" }},
                {$project :{
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }},
            ]).toArray()
            followers = followers.map(function(follower){
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}

            })
            resolve(followers)

        }catch{
            reject()
        }
    } )

}

Follow.getFollowingById = function(id){
    return new Promise(async (resolve, reject) => {
        try{
            let followers = await followCollection.aggregate([
                {$match: {authorId: id}},
                {$lookup : {from: "users", localField: "followedId", foreignField:"_id", as: "userDoc" }},
                {$project :{
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }},
            ]).toArray()
            followers = followers.map(function(follower){
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}

            })
            resolve(followers)

        }catch{
            reject()
        }
    } )

}


Follow.countFollowersById = function(id){
    return new Promise(
        async (resolve, reject) => {
            let followerCount = await followCollection.countDocuments({followedId: id})
            resolve(followerCount)
        })
}


Follow.countFollowingById = function(id){
    return new Promise(
        async (resolve, reject) => {
            let count = await followCollection.countDocuments({authorId: id})
            resolve(count)
        })
}

module.exports = Follow