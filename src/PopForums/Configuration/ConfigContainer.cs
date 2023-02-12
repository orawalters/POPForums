﻿namespace PopForums.Configuration;

public class ConfigContainer
{
	public string DatabaseConnectionString { get; set; }
	public int CacheSeconds { get; set; }
	public string CacheConnectionString { get; set; }
	public bool CacheForceLocalOnly { get; set; }
	public string SearchUrl { get; set; }
	public string SearchKey { get; set; }
	public string QueueConnectionString { get; set; }
	public string SearchProvider { get; set; }
	public bool LogTopicViews { get; set; }
	public bool UseReCaptcha { get; set; }
	public string ReCaptchaSiteKey { get; set; }
	public string ReCaptchaSecretKey { get; set; }
	public string IpLookupUrlFormat { get; set; }
	public string WebAppUrlAndArea { get; set; }
	public string BaseImageBlobUrl { get; set; }
	public string StorageConnectionString { get; set; }
	public bool RenderBootstrap { get; set; }
	public bool IsOAuthOnly { get; set; }
	public string OAuthClientID { get; set; }
	public string OAuthClientSecret { get; set; }
	public string OAuthLoginBaseUrl { get; set; }
	public string OAuthTokenUrl { get; set; }
	public string OAuthAdminClaimType { get; set; }
	public string OAuthAdminClaimValue { get; set; }
	public string OAuthModeratorClaimType { get; set; }
	public string OAuthModeratorClaimValue { get; set; }
	public string OAuthScopes { get; set; }
	public int OAuthRefreshExpirationMinutes { get; set; }
}
