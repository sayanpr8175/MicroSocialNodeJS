
const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash  = require('connect-flash')
const markdown = require('marked')
const sanitizeHTML = require('sanitize-html')
const csrf = require('csurf')
const app = express()

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))



let sessionoptions = session({
    secret : "JavaScript is sooo coool",
    store: MongoStore.create({client:require('./db')}),
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 86400000, httpOnly: true}
})

app.use(sessionoptions)
app.use(flash())

app.use(function(req, res, next){
    // making markdown available from our ejs template
    res.locals.filterUserHTML = function(content){
        return sanitizeHTML(markdown.parse(content), {allowedTags: ['p', 'br', 'ul','ol', 'li', 'strong', 'bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], allowedAttributes: {}})
    }

    // make all error and success message available from all template
    res.locals.errors = req.flash("errors")
    res.locals.success = req.flash("success")

    // make current user id available on the req object
    if(req.session.user){
        req.visitorId = req.session.user._id}
    else{
            req.visitorId = 0
        }

    // make user session data available from within View templates
    res.locals.user = req.session.user
    next()
})

const router = require('./router')
//const { use } = require('./router')


// app.use(express.urlencoded({extended: false}))
// app.use(express.json())

// Use this public folder
app.use(express.static('public'))
// 2nd argument is folder name where the view is present
app.set('views', 'views')
// letting express know we are using which view engine (we are using ejs engine / install ejs also)
app.set('view engine', 'ejs')

app.use(csrf())

app.use(function(req, res, next){
    res.locals.csrfToken = req.csrfToken()
    next()
})

app.use('/', router)

app.use(function(err, req, res, next){
    if(err){
        if(err.code == "EBADCSRFTOKEN"){
            req.flash('errors', "Cross site request forgery detected. ")
            req.session.save(() => res.redirect('/'))
        }else{
            res.render("404")
        }
    }
})

const server = require('http').createServer(app)

const io = require('socket.io')(server)

io.use(function(socket, next){
    sessionoptions(socket.request, socket.request.res, next)
})

io.on('connection', function(socket){
    if(socket.request.session.user){
        let user = socket.request.session.user
        socket.on("chatMessageFromBrowser", function(data){
            //io.emit("chatMessageFromServer", {message: data.message, username: user.username, avatar: user.avatar})

            socket.emit('welcome', {username: user.username, avatar: user.avatar})

            socket.broadcast.emit("chatMessageFromServer", {message: sanitizeHTML(data.message, {allowedTags:[], allowedAttributes:{}}), username: user.username, avatar: user.avatar})
        })
    }
})

module.exports = server


// app.listen(3000)