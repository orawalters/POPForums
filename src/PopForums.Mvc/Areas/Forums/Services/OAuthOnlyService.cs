using PopIdentity;
using PopIdentity.Providers.OAuth2;

namespace PopForums.Mvc.Areas.Forums.Services;

public interface IOAuthOnlyService
{
	string GetLoginUrl(string redirectUrl);
	Task<CallbackResult> ProcessOAuthLogin(string redirectUrl, string ip);
}

public class OAuthOnlyService : IOAuthOnlyService
{
	private readonly IConfig _config;
	private readonly IOAuth2LoginUrlGenerator _oAuth2LoginUrlGenerator;
	private readonly IStateHashingService _stateHashingService;
	private readonly IOAuth2JwtCallbackProcessor _oAuth2JwtCallbackProcessor;
	private readonly IExternalUserAssociationManager _externalUserAssociationManager;
	private readonly IUserService _userService;
	private readonly IOAuthOnlyRoleMapper _oAuthOnlyRoleMapper;

	public OAuthOnlyService(IConfig config, IOAuth2LoginUrlGenerator oAuth2LoginUrlGenerator, IStateHashingService stateHashingService, IOAuth2JwtCallbackProcessor oAuth2JwtCallbackProcessor, IExternalUserAssociationManager externalUserAssociationManager, IUserService userService, IOAuthOnlyRoleMapper oAuthOnlyRoleMapper)
	{
		_config = config;
		_oAuth2LoginUrlGenerator = oAuth2LoginUrlGenerator;
		_stateHashingService = stateHashingService;
		_oAuth2JwtCallbackProcessor = oAuth2JwtCallbackProcessor;
		_externalUserAssociationManager = externalUserAssociationManager;
		_userService = userService;
		_oAuthOnlyRoleMapper = oAuthOnlyRoleMapper;
	}

	public string GetLoginUrl(string redirectUrl)
	{
		var state = _stateHashingService.SetCookieAndReturnHash();
		var url = _oAuth2LoginUrlGenerator.GetUrl(_config.OAuthLoginBaseUrl, _config.OAuthClientID, redirectUrl, state,
			_config.OAuthScopes);
		return url;
	}

	public async Task<CallbackResult> ProcessOAuthLogin(string redirectUrl, string ip)
	{
		var callbackResult = await _oAuth2JwtCallbackProcessor.VerifyCallback(redirectUrl, _config.OAuthTokenUrl,
			_config.OAuthClientID, _config.OAuthClientSecret);
		if (!callbackResult.IsSuccessful)
			return callbackResult;
		if (string.IsNullOrEmpty(callbackResult.ResultData.Name))
		{
			callbackResult.IsSuccessful = false;
			callbackResult.Message = "Identity provider did not return a name.";
		}
		if (string.IsNullOrEmpty(callbackResult.ResultData.Email))
		{
			callbackResult.IsSuccessful = false;
			callbackResult.Message = "Identity provider did not return an email.";
		}
		if (string.IsNullOrEmpty(callbackResult.ResultData.ID))
		{
			callbackResult.IsSuccessful = false;
			callbackResult.Message = "Identity provider did not return a unique identifier.";
		}
		
		// lookup the external user
		var externalLoginInfo = new ExternalLoginInfo(
			ProviderType.OAuthOnly.ToString(), 
			callbackResult.ResultData.ID, 
			callbackResult.ResultData.Name);
		var matchResult = await _externalUserAssociationManager.ExternalUserAssociationCheck(externalLoginInfo, ip);

		User user;
		if (!matchResult.Successful)
		{
			// if not found, create the new user
			var signupData = new SignupData
			{
				Name = callbackResult.ResultData.Name,
				Email = callbackResult.ResultData.Email,
				Password = Guid.NewGuid().ToString(),
				IsCoppa = true,
				IsTos = true,
				IsSubscribed = true,
				IsAutoFollowOnReply = true
			};
			user = await _userService.CreateUserWithProfile(signupData, ip);
			await _externalUserAssociationManager.Associate(user, externalLoginInfo, ip);
		}
		else
		{
			// if found, verify name/email correct
			user = matchResult.User;
			// reconcile email
			// reconcile name
		}
		
		// set admin/mod based on claims
		await _oAuthOnlyRoleMapper.MapRoles(user, callbackResult.Claims);

		return callbackResult;
	}
}