const nodemailer = require('nodemailer');

require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NM_USER,
    pass: process.env.NM_PASS
  }
});

module.exports.SendVerification = (email, verificationKey) => {
  const mailOptions = {
    from: process.env.NM_USER,
    to: email,
    subject: 'Verify Your Account',
    html: '<h1>Welcome to Crosstalk</h1><p>Please click the link below to verify your account.</p><a href=\"localhost/verify?verificationKey=' + verificationKey + '\">localhost/verify?verificationKey=' + verificationKey + '</a><p><i>If you didn\'t request this, you can just ignore the email.</i></p><p>IMPORTANT NOTE: This project is part of my Computer Science A Level NEA. Please do not mistake this for an actual commericial service or product. You should not create or use an account if you have stumbled upon this website without being permission to use or test it. Thank you.</p>'
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) throw error;
  });
};

module.exports.SendRecovery = (email, recoveryKey) => {
  const mailOptions = {
    from: process.env.NM_USER,
    to: email,
    subject: 'Recover Your Password',
    html: '<h1>Welcome to Crosstalk</h1><p>Please click the link below to recover your account by resetting your password.</p><a href=\"localhost/account/reset-password?recoveryKey=' + recoveryKey + '\">localhost/account/reset-password?recoveryKey=' + recoveryKey + '</a><p><i>If you didn\'t request this, you can just ignore the email.</i></p><p>IMPORTANT NOTE: This project is part of my Computer Science A Level NEA. Please do not mistake this for an actual commericial service or product. You should not create or use an account if you have stumbled upon this website without being permission to use or test it. Thank you.</p>'
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) throw error;
  });
}
