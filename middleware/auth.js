const request = require('request');
module.exports = function authenticate(req, res, next) {
  req.debug('Authenticating');
  console.log('auth begins!!!')
  // Require an auth token to get the file.
  if (req.method === 'GET' && !req.query.token) {
    return res.status(401).send('Unauthorized');
  }

  if (req.query.token) {
    request.get({
      url: `${req.query.baseUrl}/form/${req.query.form}/submission/${req.query.submission}`,
      json: true,
      qs: {token: req.query.token}
    }, (err, response, body) => {
      if (err) {
        return next(err);
      }
      if (!body._id) {
        return res.status(401).send('Unauthorized');
      }

      // We are able to load the submission, so we are authenticated to download this file.
      return next();
    });
  }
  else if (req.method === 'POST') {
    if (!req.query.form || !req.query.baseUrl) {
      return next('Form not found.');
    }
  
    //get this user's assigned roles
    request.get({
      url: `${req.query.baseUrl}/current`,
      headers: {
        'x-jwt-token': req.headers['x-jwt-token']
      }
    }, (err, response) => {
      if (err) {
        return next(err);
      }

      if (response.statusCode !== 200) {
        //NOTE: returns 400 if missing required fields. I could alter this to return 200 given that specific error.
        return res.sendStatus(response.statusCode);
      }

      let body = JSON.parse(response.body)
      
      //If this is a superuser, return authenticated.
      if (body.project === process.env.PORTAL_BASE_PROJECT_ID) {
        return next()
      }

      let userRoleIds = body.roles
      
      request.get({
        url: `${req.query.baseUrl}/form/${req.query.form}`,
        headers: {
          'x-jwt-token': req.headers['x-jwt-token']
        }
      }, (err, response2) => {
        if (err) {
          return next(err);
        }

        if (response2.statusCode !== 200) {
          return res.sendStatus(response2.statusCode);
        }

        console.log('auth running to a close!!!')

        let body2 = JSON.parse(response2.body)
        let writeAccess = body2.submissionAccess.filter(access => access.type === 'create_own' || access.type === 'create_all')
        let writeAccessRoles = []
        for (let access of writeAccess) {
          writeAccessRoles.push(...access.roles)
        }
        
        //find intersection of writeAccessRoles and userRoleIds
        let intersect = userRoleIds.filter(value => writeAccessRoles.includes(value))
        if(intersect.length > 0) {
          return next()
        }
        return res.status(401).send('Unauthorized');
      });
    });

    //1 issue: if form has no granted roles, it still should be able to be accessed by the superuser. Not sure how to tell
    //  if a user is a superuser for the particular project. Worried that this solution will mean the "use" tab won't give you
    //  access if no role is assigned to create

  }
  else {
    // Everything else is unauthorized.
    return res.status(401).send('Unauthorized');
  }
};