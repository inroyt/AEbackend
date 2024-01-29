const mongoose = require('mongoose');

// Connection URL
const url = 'mongodb://localhost:27017/your_database_name';

// Connect to the database
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected successfully to the database');
    
    // Create a schemaless model
    const YourModel = mongoose.model('YourModel', new mongoose.Schema({}, { strict: false }));
    
    // Create an object that represents the data you want to save
    const newData = {
      field1: 'value1',
      field2: 'value2',
      // ...
    };
    
    // Save the data
    const document = new YourModel(newData);
    document.save(function(err, savedData) {
      if (err) {
        console.error('Failed to save data:', err);
        return;
      }
      
      console.log('Data saved successfully');
      
      // Close the connection
      mongoose.connection.close();
    });
  })
  .catch(err => {
    console.error('Failed to connect to the database:', err);
  });
