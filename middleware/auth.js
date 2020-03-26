const request = require('request');

module.exports = function authenticate(req, res, next) {
  req.debug('Authenticating');
  
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

    // Get this user's assigned roles
    request.get({
      url: `${req.query.baseUrl}/current`,
      headers: {
        'x-jwt-token': req.headers['x-jwt-token']
      }
    }, (err, userResponse) => {
      if (err) {
        return next(err);
      }

      if (userResponse.statusCode !== 200) {
        return res.sendStatus(userResponse.statusCode);
      }

      let userBody = JSON.parse(userResponse.body)

      let userTeams = userBody.teams
      let userRoleIds = userBody.roles

      // If this is a superuser, return authenticated.
      if (userBody.project === process.env.PORTAL_BASE_PROJECT_ID) {
        //find the user's teams
        request.get({
          url: `${req.query.baseUrl}`,
          headers: {
            'x-jwt-token': req.headers['x-jwt-token']
          }
        }, (err, projectResponse) => {
          if (err) {
            return next(err);
          }
  
          if (projectResponse.statusCode !== 200) {
            return res.sendStatus(projectResponse.statusCode);
          }
  
          let projectBody = JSON.parse(projectResponse.body)

          let teamAccess = projectBody.access.filter(access => access.type === 'team_access' )
          let teams = teamAccess[0].roles
          console.log('!!teams', Array.isArray(teams), teams, teams[0], typeof teams[0] )
          console.log('!!userteams', Array.isArray(userTeams), userTeams, userTeams[0], typeof userTeams[0] )

          for (let team of userTeams) {
            if (teams.includes(team)) {
              console.log('SUCCESS')
              return next()
            }
          }
          
          // Find intersection of userTeams and teams. 
          // this intersect operation is broken... not finding common value
          //let intersect = userTeams.filter(value => teams.includes(value))
  
          // If there are any overlapping roles, user can be authenticated
          /*if(intersect.length > 0) {
            return next()
          }*/
          //This means if it fails on teams, it does not check roles
          return res.status(401).send('Unauthorized');



        });
      }
      else {
        // Get roles with create access to the form
        request.get({
          url: `${req.query.baseUrl}/form/${req.query.form}`,
          headers: {
            'x-jwt-token': req.headers['x-jwt-token']
          }
        }, (err, formResponse) => {
          if (err) {
            return next(err);
          }

          if (formResponse.statusCode !== 200) {
            return res.sendStatus(formResponse.statusCode);
          }

          let formBody = JSON.parse(formResponse.body)
          let writeAccess = formBody.submissionAccess.filter(access => access.type === 'create_own' || access.type === 'create_all')
          let writeAccessRoles = []
          for (let access of writeAccess) {
            writeAccessRoles.push(...access.roles)
          }
          
          // Find intersection of writeAccessRoles and userRoleIds
          let intersect = userRoleIds.filter(value => writeAccessRoles.includes(value))

          // If there are any overlapping roles, user can be authenticated
          if(intersect.length > 0) {
            return next()
          }
          return res.status(401).send('Unauthorized');
        });
      }
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