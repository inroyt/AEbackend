const mongoose=require('mongoose');
mongoose.set("strictQuery", false);          // To avoid DeprecationWarning
const connectDB=async ()=>{
    try{
        await mongoose.connect(process.env.DATABASE_URI,{
            useUnifiedTopology:true,
            useNewUrlParser:true,
            
        })
    }catch(err){
        console.log(err);
    }
}
module.exports=connectDB;