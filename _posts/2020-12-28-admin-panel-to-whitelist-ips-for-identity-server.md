---
layout: post
title: "Admin-panel to whitelist IP's for identity server"
tags: sitecore c# back-end
---

One of our clients wanted to be sure that only white-listed IP's can log into Sitecore to manage their site. We solved this by utilizing IIS's [IP Address and Domain Restrictions](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/hh831785(v=ws.11)) feature on the [Sitecore Identity Server](https://doc.sitecore.com/developers/91/platform-administration-and-architecture/en/sitecore-identity-server.html). That way adding or removing an IP only restarts the app-pool for the Identity Server, not the Sitecore instance. Annoyingly this has meant that every so often I have to log into the production server just to add an IP address to IIS, until I made this admin-page that let's anyone with the developer role in Sitecore do this without all the hassle.

For this page to work, `Microsoft.Web.Administration.dll` needs to be available on the site. It's available from NuGet. Also, as mentioned in the code, the App Pool needs read/write access to all files in `%SystemRoot%\System32\inetsrv\config` as well as the `web.config` of the site of which the white-listed IP's need to be managed, i.e. the relevant Identity Server. Finally you need to put the IIS name of the site of interest as the constant `siteOfInterest`.

**Update:** As I was deploying this I ran into another setting that needs tweaking. IIS needs to allow write delegation on the IP Address and Domain Restrictions feature for the relevant (Identity Server) site. Go to the root of IIS and open _Feature Delegation_:

![Feature Delegation in IIS](/assets/{{page.slug}}/step-1.png)

Then pick _Custom Site Delegation_ on the right (unless you wanna set this for all sites which I would advice against)

![Custom Site Delegation button](/assets/{{page.slug}}/step-2.png)

Then select the Sitecore Identity Server up top, select _IP Address and Domain Restrictions_ on the bottom and check if it says _Read/Write_. If not, click _Read/Write_ on the right _Actions_ panel.

![Read/Write field](/assets/{{page.slug}}/step-3.png)

{% gist a8d24cc0730e2a78608e6e326eb17561 %}
<noscript>
{% highlight asp linenos %}
<%@ Page Language="C#" AutoEventWireup="true" Debug="true" %>

<%@ Import Namespace="System.Collections.Generic" %>
<%@ Import Namespace="System.Linq" %>
<%@ Import Namespace="System.Data.Linq" %>
<%@ Import Namespace="Microsoft.Web.Administration" %>
<%@ Import Namespace="Sitecore" %>

<script runat="server" language="c#">
    // For this administration page to work, IIS needs to be configured to allow Read/Write
    // delegation of the IP Address and Domain Restrictions feature on the Site of Interest
	// (overrideMode="Allow" for system.webServer/security/ipSecurity)
    // And the user this page runs under (App Pool) must have read/write access to both:
    // - %SystemRoot%\System32\inetsrv\config of the webserver
    // - web.config of the Site of Interest
    private const string siteOfInterest = "NAME OF YOUR IIS SITE";
    private ServerManager serverManager;
    private ServerManager ServerManager
    {
        get
        {
            return serverManager ?? (serverManager = new ServerManager());
        }
    }
    private Microsoft.Web.Administration.ConfigurationElementCollection IpCollection
    {
        get
        {
            return ServerManager.Sites
                .FirstOrDefault(s => s.Name.Equals(siteOfInterest))
                .GetWebConfiguration()
                .GetSection("system.webServer/security/ipSecurity")
                .GetCollection();
        }
    }
    protected override void OnInit(EventArgs arguments)
    {
        CheckSecurity(true);
        BindRepeater();
    }
    public void Page_Load(object sender, EventArgs args)
    {
        CheckSecurity(true);
        if (!IsPostBack)
        {
            BindRepeater();
        }
    }
    private void BindRepeater()
    {
        rpt.DataSource = IpCollection
            .Select(ip => ip.GetAttributeValue("ipAddress").ToString())
            .OrderBy(ip => ip);
        rpt.DataBind();
    }
    private void RemoveValue(object source, CommandEventArgs commandEventArgs)
    {
        var ipToRemove = (string) commandEventArgs.CommandArgument;
        IpCollection
            .FirstOrDefault(ip => ip.GetAttributeValue("ipAddress").Equals(ipToRemove))
            .Delete();
        ServerManager.CommitChanges();
        BindRepeater();
    }
    private void SaveValue(object sender, EventArgs e)
    {
        if (string.IsNullOrEmpty(txtValue.Text))
        {
            return;
        }
        var newIpElement = IpCollection.CreateElement();
        newIpElement.SetAttributeValue("ipAddress", txtValue.Text);
        newIpElement.SetAttributeValue("allowed", true);
        IpCollection.Add(newIpElement);
        ServerManager.CommitChanges();
        BindRepeater();
        txtValue.Text = string.Empty;
    }
    private void CheckSecurity(bool isDeveloperAllowed)
    {
        if (Sitecore.Context.User.IsAdministrator || (isDeveloperAllowed && this.IsDeveloper)) return;
        var site = Sitecore.Context.Site;
        if (site != null)
        {
            base.Response.Redirect(string.Format("{0}?returnUrl={1}", site.LoginPage, HttpUtility.UrlEncode(base.Request.Url.PathAndQuery)));
        }
    }
    private bool IsDeveloper
    {
        get
        {
            return User.IsInRole(@"sitecore\developer") || User.IsInRole(@"sitecore\sitecore client developing");
        }
    }
</script>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
	<title>Manage white-listed IP's</title>
	<link rel="Stylesheet" type="text/css" href="../default.css" />
	<link rel="Stylesheet" type="text/css" href="/sitecore/shell/themes/standard/default/WebFramework.css" />
</head>
<body>
	<form id="form1" runat="server" class="wf-container">
		<div class="wf-content">
			<h1>Manage white-listed IP's</h1>
			<table cellspacing="1" cellpadding="1" border="1">
                <tr>
                    <th>IP address</th>
                    <th>&nbsp;</th>
                </tr>
                <asp:Repeater runat="server" id="rpt" ItemType="System.String" OnItemCommand="RemoveValue">
                    <ItemTemplate>
                        <tr style="<%# Container.ItemIndex % 2 == 1 ? string.Empty : "background-color: #ddd" %>">
                            <td><%#: Item %></td>
                            <td style="text-align: center">
                                <asp:LinkButton ForeColor="Red"
                                    runat="server"
                                    OnCommand="RemoveValue"
                                    CommandArgument="<%#: Item %>"
                                    OnClientClick="return confirm('Remove this IP?')">&#215;</asp:LinkButton>
                            </td>
                        </tr>
                    </ItemTemplate>
                </asp:Repeater>
                <tr>
                    <td><asp:TextBox runat="server" id="txtValue" ValidationExpression="" /></td>
                    <td style="text-align: center">
                        <asp:LinkButton ForeColor="Green" runat="server" OnClick="SaveValue">Add</asp:LinkButton>
                    </td>
                </tr>
            </table>
            <asp:RegularExpressionValidator ID="RegularExpressionValidatorIp" runat="server"
                ErrorMessage="Invalid IP Address!" ValidationExpression="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\.|$)){4}"
                ControlToValidate="txtValue"></asp:RegularExpressionValidator>
		</div>
	</form>
</body>
</html>
{% endhighlight %}
</noscript>
