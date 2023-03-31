const otpService   = require('../services/otp-service');
const hashService  = require('../services/hash-service');
const userService  = require('../services/user-service');
const tokenService = require('../services/token-service');
const UserDto      = require('../dtos/user-dto');

class AuthController{
    async sendOtp(req,res){

        //logic
        //get the phone number from req
        const {phone} = req.body;
        if(!phone){
            res.status(400).json({message:'Phone field is required'});
        }

        //generate 4 digit OTP
        const otp = await otpService.generateOtp();

        // console.log(otp);

        // hash opt 
        const ttl = 1000 * 60 * 2; //2 min expiry 
        const expires = Date.now() + ttl;
        const data = `${phone}.${otp}.${expires}`;
        console.log(data);
        const hash = hashService.hashOtp(data);


        // send otp
        try {
            // await otpService.sendBySms(phone, otp);
            res.json({
                hash: `${hash}.${expires}`,
                phone,
                otp,
            });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: 'message sending failed' });
        }
    }

    async verifyOtp(req,res){
        const { otp, hash, phone } = req.body;
        if(!otp|| !hash || !phone){
            res.status(400).json({message: " All Fields are required!"});

        }

        const [hashedOtp , expires] = hash.split('.');

        // check if otp is expired 
        if(Date.now() > +expires){  //convert expire from string to number
            res.status(400).json({message: "OTP expired"});
        }

        // verify otp
        const data = `${phone}.${otp}.${expires}`;
        const isvalid = otpService.verifyOtp(hashedOtp , data);
        if(!isvalid){
            res.status(400).json({message:"Invalid OTP"})
        }

        let user;

        // check if user already exists or create the user
        try{
            user = await userService.findUser({phone})
            if(!user){
                user = await userService.createUser({phone})
            }
        }catch(err){
            console.log(err);
            res.status(500).json({message:'DB error'});
        }

        // tokens
        const { accessToken ,refreshToken } = tokenService.generateTokens({_id:user._id ,activated:false});

        // store refreshToken in database
        await tokenService.storeRefreshToken(refreshToken , user._id);
       
        // attach refreshToken to cookie
        res.cookie('refreshToken', refreshToken ,{
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        });

        res.cookie('accessToken', accessToken ,{
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        });

        // transform user before sending it  
        const userDto = new UserDto(user);
        res.json({user: userDto , auth:true});

    }

    async refresh(req,res){
        // get refresh token from cookie
        const { refreshToken: refreshTokenFromCookie } = req.cookies;

        // check if refresh token is valid
        let userData;
        try{
            userData = await tokenService.verifyRefreshToken(refreshTokenFromCookie);
        }catch(err){
            return res.status(401).json({message:"Invalid Token"});
        }

        // check if refresh token is present in database
        try{
            const token = await tokenService.findRefreshToken(
                userData._id ,
                refreshTokenFromCookie
                );
            if(!token){
                return res.status(401).json({message:"Invalid Token"});
            }
        }catch(err){
            return res.status(500).json({message:'Internal Error'});
        }

        // check if valid user
        const user = await userService.findUser({ _id: userData._id });
        if(!user){
            return res.status(404).json({message:"No user found"});
        }

        // generate new set of tokens
        const { refreshToken , accessToken } = tokenService.generateTokens({ _id:userData._id }) ;

        // update refresh token in database
        try{
            tokenService.updateRefreshToken(userData._id , refreshToken);
        }catch(err){
            return res.status(500).json({ messsage: 'Internal Error'});
        }

        // put them in cookie
        res.cookie('refreshToken', refreshToken ,{
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        });

        res.cookie('accessToken', accessToken ,{
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        });

        // transform user before sending it  
        const userDto = new UserDto(user);

        // response
        res.json({user: userDto , auth:true});

        
    }

    async logout(req,res){
        const{refreshToken} = req.cookies;
        // delete refresh token from db
        await tokenService.removeToken(refreshToken);

        // delete cookies
        res.clearCookie('refreshToken');
        res.clearCookie('accessToken');
        res.json({ user : null , auth:false});
    }
    
}

module.exports = new AuthController();