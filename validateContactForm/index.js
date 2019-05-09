'use strict';

const AWS = require("aws-sdk");
const axios = require('axios');
const completeUrl = "https://www.google.com"; // TODO: update redirect
const reCapUrl = "https://www.google.com/recaptcha/api/siteverify";

// we got this from personal reCaptcha Google Page
const reCaptchaSecret = `${process.env.GOOGLE_RECAPTCHA_SECRET}`; 

// we need to grab this from Amazon SNS
const snsTopic = "arn:aws:sns:ap-southeast-2:098535834498:validContactForm"; 

module.exports.webhook = async (event, context, callback) => {
  console.log("Starting ContactForm Processing for website form.");

  let body = event.body;

  console.log(body);

  // process the urlencoded body of the form submit and put it in a 
  // map structure
  let parts = body.split('&');
  let result = [];
  // grab the params 
  for (let i = 0, len = parts.length; i < len; i++) { 
     let kVal = parts[i].split('=');
     // replace the + space then decode
     let key = decodeURIComponent(kVal[0].replace(/\+/g, ' '));
     result[key] = decodeURIComponent(kVal[1].replace(/\+/g, ' '));
  }

  // its always a good idea to log so that we can inspect the params
  // later in Amazon Cloudwatch
  console.log(result);

  // verify the result by POSTing to google backend with secret and
  // frontend recaptcha token as payload
  let verifyResult = await axios.post(reCapUrl, {
    secret: reCaptchaSecret,
    response: result["g-recaptcha-response"]
  });

  // if you like you can also print out the result of that. Its
  // a bit verbose though
  console.log(verifyResult);

  if (verifyResult.status === 200) { 
    // 200 means that Google said the token is ok
    // now we create a simple emailbody aka the body of the SNS
    // message. If you want to do more than just emailing, you 
    // should rethink the structure of the message though
    let emailbody = "Contact Form <contact.andrewmadden.tech>"
        + "\n\nName: " + result["name"]
        + "\nEmail: " + result["email"]
        + "\n\nSubject: " + result["subject"]
        + "\nMessage: " + result["message"]
    let sns = new AWS.SNS();
    let params = {
       Message: emailbody,
       Subject: "ContactForm: "+result["subject"],
       TopicArn: snsTopic
    };
 
    // we publish the created message to Amazon SNS now…
    sns.publish(params, context.done);
 
    // now we return a HTTP 302 together with a URL to redirect the
    // browser to success URL (we put in google.com for simplicty)
    callback(null, {
      statusCode: 302,
      headers: {
        Location: completeUrl,
      }
    });
  } else {
    console.log("reCaptcha check failed. Most likely SPAM.");
  }
};