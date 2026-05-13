export const fetchTenantsSetting = async ()=>{
    const url ='https://api.tenants.sanchidev.in/api/v1/public/global/verify_tenant/thub.sanchidev.i';

    const response =await fetch (url);
    const data =await response?.json();
    return data;
}



export const fetchSettingStyle = async (baseUrl) => {
  const url = `${baseUrl}api/v1/public/global/settings`;

  const response = await fetch(url);
  return await response.json();
};

export const fetchFundingStages = async (baseUrl) => {
  const url = `${baseUrl}api/v1/public/global/funding_stages`;

  const response = await fetch(url);
  return await response.json();
};

export const fetchInvestmentMechanisms = async (baseUrl) => {
  const url = `${baseUrl}api/v1/public/global/custom/investment_mechanisms`;

  const response = await fetch(url);
  return await response.json();
};

export const verifyEmail = async (
  baseUrl,
  email,
  userType = 'startup',
  investorType = '',
) => {
  const url = `${baseUrl}api/v1/public/auth/verify/email/${email}?userType=${userType}&investorType=${investorType}`;

  const response = await fetch(url);
  return await response.json();
};

export const verifyMobileNumber = async (
  baseUrl,
  mobileNumber,
  userType = 'startup',
  investorType = '',
) => {
  const url = `${baseUrl}api/v1/public/auth/verify/mobile/${mobileNumber}?userType=${userType}&investorType=${investorType}`;

  const response = await fetch(url);
  return await response.json();
};

// LOGIN FLOW OF API
// ${baseUrl}api/v1/public/auth/mobile/login

// ${baseUrl}api/v1/public/auth/mobile/login/verify
// Request Method:POST
// {
//     "countryCode": 91,
//     "code": "840b37847dbecfa4be4cf70cfade8d1d",
//     "email": "thub-dev-invester@yopmail.com"
// }
// ${baseUrl}api/v1/users/profile


//SIGNUP FLOW OF API
// getApi for email or mobile number verification
//${baseUrl}api/v1/public/auth/verify/email/vishali@yop.com?userType=startup&investorType=
// ${baseUrl}api/v1/public/auth/verify/mobile/987654345678?userType=startup&investorType=
//post api for sending otp
//${baseUrl}api/v1/public/otp_verifications/send
// {
//     "type": "email",
//     "countryCode": 91,
//     "mobileNumber": 987654345678,
//     "emailAddress": "vishali@yop.com"
// }

// ${baseUrl}api/v1/public/auth/mobile/login/verify
// {
//     "countryCode": 91,
//     "code": "dc1322dd294effcdac9942803027b362",
//     "email": "thub-dev-startup@yopmail.com"
// }

// ${baseUrl}api/v1/public/auth/register/
//jo data available nhi h usko static data se replace krna h
// {
//     "name": "THUB-Investor",
//     "emailAddress": "thub-dev-invester@yopmail.com",
//     "countryCode": 91,
//     "mobileNumber": 987654356,
//     "userType": "investor",
//     "investorType": "organization",
//     "companyName": "THUB-Investor",
//     "organizationName": "KAhiheu_Demo",
//     "howDidYouFindUs": "",
//     "emailVerificationId": "63468821-0f04-4315-9f45-7c0650269ac5",
//     "designation": "",
//     "website": "",
//     "servicesLookingFor": [
//         "fundraising",
//         "tech_hiring",
//         "customer_access",
//         "mentorship",
//         "business_services"
//     ],
//     "referralCode": null,
//     "applyingForSpecificEvent": false,
//     "programs": [],
//     "programCodes": []
// }

// get  ${baseUrl}api/v1/users/profile
